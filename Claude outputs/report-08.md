# تقرير برومبت 08 — أمان الجلسات: إيقاف المستقيل، وعرض الأجهزة وإيقافها

- **التاريخ:** 2026-11-16
- **الباك إند:** `D:\trae project\delton-hr-erp_clean` (قراءة/كتابة، **بلا أي `git add`/`commit`/`push`** كما تشترط القواعد)
- **التطبيق:** `D:\MOBLIE APP Deltoncore` (المرحلة 5 + الوثائق + commit محلي واحد)
- **البرومبت الحاكم:** `Claude outputs/prompt-builder-08-security-sessions.md`

> اصطلاح في هذا التقرير: **مُختبَر** = شغّلتُ الأمر ورأيت نتيجته. **مكتوب** = كُتب في الكود ولم أشغّله.
> كل رقم أو اسم كود في هذا التقرير مقروء من الملفات أو من مخرجات أوامر حقيقية، لا من الذاكرة.

---

## 1. ما تم لكل مرحلة

### المرحلة 1 — إنهاء الخدمة يوقف حساب الدخول

**ملف جديد `core/services/access_revocation.py`** — نقطة واحدة تلغي كل أنواع الوصول:

- `revoke_user_access(user, *, reason, actor=None, request=None)` داخل `@transaction.atomic` وتنفّذ بالترتيب:
  1. `user.is_active = False`؛
  2. إنهاء جلسات الويب عبر `core.api_views._um_invalidate_sessions_for_user` (الموجودة، لا نسخة جديدة)؛
  3. `core.mobile.devices.revoke_all_devices`؛
  4. سوداء كل `OutstandingToken` قائم للمستخدم عبر `BlacklistedToken`؛
  5. سطر `AuditLog` واحد يذكر السبب والعدّادات الثلاثة.
- **حماية آخر Super Admin نشط:** إن كان المستهدف آخر حساب نشط (`is_superuser` أو دور `Super Admin`) تُرفض العملية، ويُكتب سطر تدقيق `users.access_revoke_blocked`، ويُرسل إشعار داخلي `super_admin_deactivation_blocked` لبقية مديري النظام بدل الصمت.
- **آمنة عند التكرار:** لا كتابة `is_active` ولا سطر تدقيق جديد إن كان كل شيء مُلغى سلفًا.
- `revoke_leaver_account(employee, ...)` تحلّ حساب الموظف عبر `resolve_user_for_employee` (تُرجِع `None` لموظف بلا حساب).

**ملف جديد `core/services/leaver_accounts.py`** — نقطة الاستدعاء للمسح المجدول (المسارات التي تُنهي الخدمة دون المرور بمسار الإنهاء اليدوي).

**الاستدعاءات** (لا مسار واحد فقط): `core/services/employment.py` (`apply_termination_completed`)، مسار الإنهاء المختصر و`settings_users_toggle_active` و`settings_users_delete` في `core/api_views.py`، `core/terminations_api.py`، و`core/management/commands/run_scheduled_jobs.py`.

**`core/services/employee_identity.py`** — أُضيفت `resolve_user_for_employee`، وهي العكس التام لـ `resolve_employee_for_user` بنفس شرطَي المطابقة (الحساب المرتبط أولًا، ثم المطابقة القديمة `username == employee_number` بشرط عدم وجود رابط وعدم تعطيله).

**`core/notifications/registry.py`** — تسجيل أحداث الإشعار الجديدة.

**إعادة التعيين (`employee_rehire`) لا تعيد تفعيل الحساب:** التفعيل يبقى قرارًا يدويًا؛ الحساب المعطَّل يبقى معطَّلًا بعد إعادة التعيين.

### المرحلة 2 — تسجيل الجهاز عند كل دخول

- **`core/mobile/views.py`:** كل دخول ناجح من `/api/mobile/login/` يستدعي `register_device` — **بـ 2FA أو بدونها** — فالمستخدم بلا 2FA يظهر أيضًا في شاشة الأجهزة. غياب `device_id` يرجع `400` بكود `device_id_required`.
- **`core/mobile/devices.py`:** `register_device` تُنشئ أو تُحدّث الصف بـ `update_or_create(user_id, device_id)`؛ الحقول الوصفية تُقصّ (`device_name` 120، `os_version` 60، `app_version` 40، `last_ip` 45)، و**لا يُكتب حقل وصفي إلا إن أُرسل فعلًا**، فدخول لاحق بلا الحقول لا يمسح ما سجّله دخول سابق. `touch_device_seen_if_stale` تُحدِّث `last_seen_at`/`last_ip` بحد أقصى مرة كل `SEEN_TOUCH_INTERVAL = 5 دقائق` لكل جهاز — أي لا كتابة في القاعدة مع كل طلب.
- **الثقة لم تتغيّر:** لا تجاوز لـ 2FA بمجرد وجود صف جهاز؛ التجاوز يبقى مشروطًا بـ `device_secret` صحيح غير منتهٍ (`verify_device_secret` بمقارنة ثابتة الزمن).
- **`core/migrations/0158_mobiledevicetoken_device_metadata.py` (جديد):** أربعة `AddField` (`device_name`, `os_version`, `app_version`, `last_ip`) — إضافي بحت، بقيمة افتراضية سلسلة فارغة، بلا حذف أي عمود ولا تغيير بيانات قائمة، وكل عملية فيه قابلة للعكس.

### المرحلة 3 — ربط التوكن بالجهاز

- **`core/mobile/auth.py`:** `MobileJWTAuthentication.DEVICE_CLAIM = 'did'` والـ claim يُوضع على الـ refresh (ومن ثمّ على الـ access). `_check_device_binding(user, validated_token, request)`:
  - توكن بلا `did` → `401` بكود `device_required` ونص `This token is not bound to a device. Sign in again from the app.`؛
  - `did` لا يطابق صفًا **نشطًا يخص نفس المستخدم** → `401` بكود `device_revoked` ونص `This device has been deactivated by the administrator.`؛
  - الاستعلام واحد ومفهرس (`get_active_device_for_auth` → `filter(pk=…, user_id=…, is_active=True).values('id','last_seen_at').first()`)، ويليه تحديث آخر ظهور من المرحلة 2 في نفس الاستدعاء.
- **`core/mobile/views.py`:** `mobile_token_refresh` يتحقق من نشاط المستخدم **ونشاط الجهاز** قبل الإصدار، و**ينقل `did`** إلى الزوج الجديد (لأن الصيغة السابقة كانت تُبنى بـ `for_user` فتضيع الـ claims المخصّصة).
- **`unregister_device` و`revoke_all_devices` أصبحتا توقفان الجهاز فعليًا** بحكم البند أعلاه: توكن الجهاز المُبطَل يُرفض من الطلب التالي. إيقاف جهاز لا يمسّ جهازًا آخر لنفس المستخدم.

### المرحلة 4 — شاشة الأجهزة والجلسات في برنامج الموارد البشرية

**الباك إند — ستة مسارات في `core/api_urls.py` (السطور 338–343)، كلها بصلاحية `core.can_manage_users` وبنفس حمايات إدارة المستخدمين (غير الـ Super Admin لا يدير حساب Super Admin):**

| المسار | الدالة | الوظيفة |
| --- | --- | --- |
| `GET settings/users/<id>/devices/` | `settings_user_devices` | أجهزة الموبايل (نشطة ومُبطَلة، الأحدث أولًا) |
| `POST settings/users/<id>/devices/<device_pk>/revoke/` | `settings_user_device_revoke` | إيقاف جهاز واحد |
| `POST settings/users/<id>/devices/revoke-all/` | `settings_user_devices_revoke_all` | إيقاف كل أجهزة المستخدم |
| `GET settings/users/<id>/sessions/` | `settings_user_sessions` | جلسات الويب الحية من `UserSession` |
| `POST settings/users/<id>/sessions/end-all/` | `settings_user_sessions_end_all` | إنهاء جلسات الويب للمستخدم |
| `GET settings/devices/` | `settings_devices` | كل الأجهزة النشطة في النظام، بحث باسم المستخدم، الأحدث ظهورًا أولًا |

- **لا يُرجَع أبدًا** `fcm_token` ولا `trust_secret_hash` ولا `device_id` الخام: `_um_serialize_mobile_device` يُرجع `device_label` مُقنَّعًا عبر `_um_mask_device_id` (بادئة/لاحقة فقط)، و`_um_serialize_web_session` لا يُرجع `session_key` لأنه بيانات اعتماد جلسة.
- المستخدم لا يستطيع إنهاء جلسته الحالية من هذه المسارات.
- كل عملية إيقاف تُكتب في سجل التدقيق باسم المنفِّذ والمستهدف والجهاز.

**`hr_frontend`:** قسم «الأجهزة والجلسات» في `src/pages/settings/Users.tsx`، صفحة جديدة `src/pages/settings/Devices.tsx`، وتحديث `navigation/navConfig.tsx` و`App.tsx` و`locales/ar.json` و`locales/en.json`.

### المرحلة 5 — التطبيق (`D:\MOBLIE APP Deltoncore`)

| المطلوب | المنفَّذ |
| --- | --- |
| إضافة الأكواد الثلاثة إلى `ApiErrorCode` و`API_ERROR_CODES` و`messageFor` | `src/api/types.ts`: `'device_id_required'`, `'device_required'`, `'device_revoked'` في `API_ERROR_CODES`؛ `src/api/client.ts`: ثلاث حالات في `messageFor`، ونص `device_revoked` حرفيًا: «تم إيقاف هذا الجهاز من الإدارة. راجع الموارد البشرية.» |
| `device_revoked`/`device_required` يُسقطان الجلسة ولا يُجرَّب معهما تجديد | أُعيدت هيكلة `request()`: صار `errorPayload` يُقرأ **قبل** قرار التجديد، ويُحسب `deviceBindingLost`، ويُمنع `tryRefresh()` عنده، ثم يسقط الجلسة (`clearTokens()` + `onSessionLost?.()`) مثل `account_inactive` |
| إرسال `device_name`/`os_version`/`app_version` مع الدخول بلا حزمة جديدة | `deviceMetadata()` تقرأ `Platform.constants` (Android: `Brand`+`Model` و`Release`؛ iOS: `systemName`/`osVersion`؛ غير ذلك: معرّف المنصّة)، والإصدار من `app.json` (`appConfig.expo.version`) فلا ينفصل عن البناء. تُدمج في `api.login` بعد `platform: 'android'` |
| تحديث الخادم الوهمي واختبارات `client.test.ts`، و`tsc`/`npm test` نظيفان | `src/api/mock.ts`: قالب دخول `revoked` + راية `mockDeviceRevoked` تُسقط كل مسار محمي بـ `401 device_revoked`. `src/api/__tests__/client.test.ts`: ثلاثة اختبارات جديدة |

### الوثائق

`MOBILE_API.md` (خمس تعديلات، كلها مقروءة من الكود): §1 صار يوثّق `device_id` الإلزامي و`platform` والحقول الوصفية الثلاثة → جدول حقول مع ✅/⬜ وملاحظة أن الحقول الوصفية لا تُمسح بدخول لاحق ناقص؛ §1 جدول رسائل الخطأ + صف `400 | device_id_required`؛ §2 (`/me/`) و§3 (`/token/refresh/`) صفّا `device_required` و`device_revoked` بنصوص الـ `detail` الإنجليزية الأصلية؛ §15.3 جديدة «إلزامية `device_id` وربط التوكن بالجهاز (T08)»؛ §15.4 جديدة «مسارات الإدارة: الأجهزة والجلسات (T08)» بجدول المسارات الستة وحقول التسلسل المسموحة والممنوعة.

---

## 2. ما تحقّقت منه فعلًا: الأمر ونتيجته

### 2.1 التطبيق (`D:\MOBLIE APP Deltoncore`)

| # | الأمر | النتيجة كما ظهرت |
| --- | --- | --- |
| 1 | `npx tsc --noEmit` | `TSC_EXIT=0` (لا مخرجات) |
| 2 | `npm test` | `PASS src/api/__tests__/client.test.ts` · `Tests: 9 passed, 9 total` · `Time: 4.598 s` |

ومن الاختبارات التسعة الثلاثة الجديدة، بأسمائها كما طُبعت:

```
√ drops a revoked device without spending a refresh on it (1 ms)
√ drops a token that names no device, the same way (1 ms)
√ tells the supervisor that the administrator deactivated this device (1 ms)
```

الأول يثبّت الشرط الحرج: `refreshCalls === 0` — أي **لا يُصرَف أي طلب تجديد** على `device_revoked`، والجلسة تُسقَط.

### 2.2 الباك إند

| # | الأمر | النتيجة كما ظهرت |
| --- | --- | --- |
| 3 | `pytest core/mobile/tests/ core/test_two_factor.py core/test_session_policy.py core/test_user_management_security.py core/test_terminations_workflow.py -q` | `173 passed, 148 warnings in 308.15s (0:05:08)` |
| 4 | `pytest core/test_access_revocation.py core/test_leaver_accounts.py -q` | `23 passed, 12 warnings in 70.06s (0:01:10)` |
| 5 | `ruff check .` | `All checks passed!` |
| 6 | `python scripts/check_blind_except_tuples.py` | exit `0` بلا مخرجات |

> العدّاد 4 أُضيف لأن ملفَّي الاختبار الجديدين يقعان في `core/` لا داخل المسارات الخمسة المذكورة في البرومبت، فلم يكن أمر البند 3 يجمعهما.

### 2.3 الـ migration يُطبَّق ويُعكَس على قاعدة تطوير — **مُختبَر**

نُفِّذ على **قاعدة تطوير SQLite ملفّية منفصلة فعلًا** (عملية Python جديدة، ووحدة settings خاصة تُوجِّه `DATABASES` إلى ملف SQLite مؤقت). المخرج نفسه يُثبت الهدف:

```
CONNECTION ENGINE : django.db.backends.sqlite3
CONNECTION NAME   : C:\...\Temp\t08check\t08.sqlite3
CONNECTION VENDOR : sqlite

[1] after full migrate  -> last core migrations: ['0158_mobiledevicetoken_device_metadata', '0157_web_session_registry', '0156_...']
    device columns      : [..., 'device_name', 'os_version', 'app_version', 'last_ip']

Unapplying core.0158_mobiledevicetoken_device_metadata... OK
Unapplying core.0157_web_session_registry... OK

[2] after REVERSE to 0156 -> last core migrations: ['0156_...', '0155_...', '0154_...']
    device columns        : [...]   # الأعمدة الأربعة اختفت

Applying core.0157_web_session_registry... OK
Applying core.0158_mobiledevicetoken_device_metadata... OK

[3] after RE-APPLY to 0158 -> last core migrations: ['0158_...', '0157_...', '0156_...']
    device columns          : [..., 'device_name', 'os_version', 'app_version', 'last_ip']
```

إطباق ← عكس ← إعادة إطباق، مع إثبات اختفاء الأعمدة الأربعة في العكس وعودتها في الإطباق.

### 2.4 عدد الاستعلامات — **مُختبَر**

الطريقة: طلب موبايل مصادَق عليه واحد (`GET /api/mobile/me/`) بتوكن مرتبط بجهاز، يُقاس مرتين بـ `CaptureQueriesContext`:
**(A)** المسار الحقيقي، **(B)** نفس الطلب بعد تعطيل الدالة التي أضافها هذا العمل (`MobileJWTAuthentication._check_device_binding`) — وهذا هو «قبل هذا العمل» حرفيًا.

```
warm-up status                    : 200

A) real auth path (T08 ON )       : status 200 | queries: 10
B) T08 check removed (= before)   : status 200 | queries: 9

DELTA (T08 device binding adds)    : 1 query/queries
```

وقوائم الاستعلامات تُظهر أن **الفرق هو استعلام واحد فقط**، هو نفسه الفحص المضاف:

```
SELECT "core_mobiledevicetoken"."id", "core_mobiledevicetoken"."last_seen_at"
FROM "core_mobiledevicetoken"
WHERE ("core_mobiledevicetoken"."id" = ... AND "core_mobiledevicetoken"."user_id" = ... AND "core_mobiledevicetoken"."is_active")
```

**النتيجة: استعلام واحد بالضبط — أي لا يزيد بأكثر من استعلام واحد كما يشترط البرومبت.** ولا كتابة (`UPDATE`) في الطلب لأن `touch_device_seen_if_stale` تُطلق فقط بعد 5 دقائق من آخر ظهور.

### 2.5 ⚠️ حادثة وقعت أثناء التحقق (وجب ذكرها لا تجاوزها)

**ما حدث:** أول محاولة لتحقيق البند 2.3 استخدمت `override_settings(DATABASES=...)` ثم `call_command('migrate')` من داخل عملية Python قائمة. غيّر `override_settings` قيمة `settings.DATABASES` **ولم يغيّر الاتصال المفتوح** (`settings` قالت SQLite، والاتصال الحقيقي ظل PostgreSQL). فذهب أمر الـ migrate إلى **قاعدة التطوير** التي يشير إليها `.env` في الباك إند، وطبّق:

```
('core', '0158_mobiledevicetoken_device_metadata', 2026-11-16 10:25:42.519205+00:00)
('core', '0157_web_session_registry',              2026-11-16 10:25:42.115852+00:00)
```

ثم فشل عند عبارة خاصة بـ SQLite (`PRAGMA`) — وهو ما أكّد أن الاتصال كان PostgreSQL لا SQLite.

**حجم الأثر:**
- `0157` **موجودة في المستودع أصلًا** (ودائعها `9fe7b19`)، فقاعدة التطوير كانت متأخرة عنها فقط؛ و`0158` هي migration هذا العمل.
- لا شيء عُكس، ولا حُذف عمود، ولا تغيّر أي صف. الأثر هو أن القاعدة تحمل الآن هذين الـ migration مطبَّقَين.
- لم يُطبع أي شيء من `.env`، ولم يُلمس أي ملف في مجلد `deploy`.

**ما لم أفعل ولماذا:** البرومبت يقول «لو تعذّرت مرحلة، توقف عندها واكتب السبب بدل الالتفاف عليها»، فأنا **لم أعكس** `0157`/`0158` من تلك القاعدة لأن عكس migration على قاعدة تطوير ليست ملكي قرارًا يستحق سؤالك، وترك الأثر موثّقًا أأمن من عملية عكس غير مطلوبة. القرار في القسم 7.
**وقد أُعيد التحقق بشكل صحيح** على قاعدة SQLite منفصلة فعلًا (البند 2.3) — لا `override_settings` على اتصال مفتوح.

---

## 3. ما كتبته ولم أختبره، ولماذا

| البند | لماذا لم يُختبر |
| --- | --- |
| فرع iOS وفرع «غير أندرويد» في `deviceMetadata()` | `jest` يعمل بمنصّة واحدة، ولم أشغّل التطبيق على جهاز/محاكي iOS. الكود مكتوب من تعريفات `Platform.constants` المقروءة من `react-native/types_generated/...` |
| إرسال الحقول الوصفية من جهاز حقيقي وظهورها في شاشة الإدارة | يحتاج تشغيل التطبيق على جهاز متصل بالخادم |
| `hr_frontend`: قسم «الأجهزة والجلسات» في `Users.tsx` وصفحة `Devices.tsx` | **لم أفتح الواجهة في متصفح ولم أُشغّل أي اختبار للواجهة.** الملفات معدّلة/منشأة فقط |
| `core/test_frontend_api_contract.py` لم يُحدَّث | فُحص فعليًا: لا يحتوي أي ذكر لـ `device` ولا `session` (بحث غير حسّاس لحالة الأحرف)، فالشرط «إن كان يغطي هذه الصفحات» غير متحقق |
| سلوك `settings_devices` مع البحث والصفحات في واجهة حقيقية | مُختبَر على مستوى الـ API فقط بحسب ما طُلب في البرومبت |
| `core/services/leaver_accounts.py` في المسح المجدول الزمني الفعلي | له اختبارات (`test_leaver_accounts.py`، 23 اختبارًا مع نجاح)، لكن لم أُشغّل المهمة المجدولة يدويًا في بيئة حقيقية |
| وضع `TENANCY_MODE=multi` | مؤجّل بقرار من البرومبت نفسه؛ التفاصيل في القسم 5 |

**ولم يُودَع أي شيء في الباك إند** — التزامًا بالقاعدة 1.

---

## 4. قائمة الملفات المعدّلة في الباك إند (للمراجعة قبل الـ commit)، والـ migrations الجديدة

### معدّلة (وموجودة في المستودع)

```
MOBILE_API.md
core/api_urls.py
core/api_views.py
core/mobile/auth.py
core/mobile/devices.py
core/mobile/views.py
core/mobile/tests/test_mobile_api.py
core/mobile/tests/test_mobile_notifications.py
core/mobile/tests/test_mobile_routes.py
core/notifications/registry.py
core/services/employee_identity.py
core/services/employment.py
core/terminations_api.py
core/management/commands/run_scheduled_jobs.py
core/test_two_factor.py
core/test_user_management_security.py
hr_frontend/src/App.tsx
hr_frontend/src/locales/ar.json
hr_frontend/src/locales/en.json
hr_frontend/src/navigation/navConfig.tsx
hr_frontend/src/pages/settings/Users.tsx
```

### ملفات جديدة

```
core/migrations/0158_mobiledevicetoken_device_metadata.py
core/services/access_revocation.py
core/services/leaver_accounts.py
core/test_access_revocation.py
core/test_leaver_accounts.py
hr_frontend/src/pages/settings/Devices.tsx
```

### الـ migrations

| الـ migration | الحالة | المحتوى |
| --- | --- | --- |
| `core/0157_web_session_registry` | **موجودة قبل هذا العمل** (وديعة `9fe7b19`) | `max_active_sessions` + موديل `UserSession` + سجل الجلسات |
| `core/0158_mobiledevicetoken_device_metadata` | **جديدة في هذا العمل** | أربعة `AddField` إضافية وقابلة للعكس على `MobileDeviceToken` |

> **ليست من هذا العمل:** شجرة العمل تحتوي مسبقًا على حذف عدد كبير من ملفات `deploy/installer/patches/...` و`deploy/DeltonCore_Setup_v1.1.6-r6_Portable/...`، وعلى مجلد غير متتبَّع `graphify-out/`. **لم أمسّ أيًّا منها** — لا إنشاءً ولا حذفًا.

---

## 5. ما ينقص في وضع تعدد الشركات

القاعدة 6 في البرومبت تسمح بترك ما لا يعمل بنفس المعنى، بشرط كتابته. الناقص:

1. **فحص ربط الجهاز لا يعمل إطلاقًا في `multi`.** في `core/mobile/auth.py`:
   `if not _tenancy_conf.MULTI: self._check_device_binding(user, validated_token, request)`
   والتعليق يشرح السبب: لا يوجد جدول أجهزة مركزي في وضع تعدد الشركات. أي أن `device_revoked`/`device_required` **لا يُطلقان** في `multi`، وتوكن جهاز مُبطَل يظل يعمل هناك.
2. **إلغاء الوصول عند انتهاء الخدمة موثَّق كـ no-op في `multi`.** `revoke_user_access` تُرجع `{'skipped': 'multi_company_mode', ...}` قبل أي كتابة، لأن `user` هناك ظلّ محلي تُعاد مزامنته من العضوية المركزية، ولا يجوز تعطيل الهوية المركزية بسبب إنهاء خدمة في شركة واحدة. المتبقي للخطوة اللاحقة: تعطيل العضوية على مستوى الشركة + إلغاء الأجهزة/التوكنات المحلية للشركة.
3. **مسارات إدارة الأجهزة والجلسات لا تحمل أي حارس `multi`.** تقرأ جداول قاعدة الشركة الحالية، فالنطاق في `multi` هو شركة الجلسة وحدها — لا عرض مركزي لكل الشركات.
4. **سوداء التوكنات تعتمد على `OutstandingToken` المركزي.** توكن لم يُخزَّن هناك (صادر قبل تثبيت السوداء، أو سوداء محلية للشركة) لا يمكن إحراقه من هذه الدالة.

كل ما سبق يعمل بالمعنى المقصود في وضع الشركة الواحدة (`TENANCY_MODE=single`) الذي هو موضوع هذا البرومبت.

---

## 6. تيستات قائمة تغيّر توقعها، مع السبب

لم يُضعَّف أي تيست ليمر. التغييرات التالية **سببها أن التوقع القديم صار خاطئًا فعلًا** بسبب هذا العمل:

| الملف | التغيير | السبب |
| --- | --- | --- |
| `core/mobile/tests/test_mobile_routes.py` | `_access_for(user)` (14 سطرًا): كانت `return str(RefreshToken.for_user(user).access_token)`، وصارت تُسجّل جهازًا أولًا وتضع `refresh[MobileJWTAuthentication.DEVICE_CLAIM] = int(device.pk)` | توكن مبنيّ يدويًا بلا `did` **يجب** أن يُرفض بـ `device_required`؛ فالتيستات التي تصنع توكنًا بنفسها صارت تسجّل صف الجهاز — وهو ما يفعله الدخول الحقيقي بالضبط |
| `core/mobile/tests/test_mobile_notifications.py` | نفس التعديل على `_access_for` (9 أسطر) | نفس السبب |
| `core/mobile/tests/test_mobile_api.py` | طلبات `/api/mobile/login/` صارت تُرسل `device_id`؛ والتوكنات الموضوعة يدويًا (`RefreshToken.for_user`) صارت مرتبطة بصف جهاز | `device_id` صار إلزاميًا → بدونه `400 device_id_required`؛ والتوكن بلا `did` مرفوض |
| `core/test_two_factor.py` | **إضافات فقط** (+13) — لا تغيّر توقع قائم | اختبار يثبت أن مستخدم 2FA بصف جهاز مسجَّل وبلا `device_secret` **ما زال يُطلب منه الرمز** (الثقة لم تتغيّر) |
| `core/test_user_management_security.py` | **إضافات فقط** (+200) | اختبارات مسارات إدارة الأجهزة/الجلسات وحماية آخر Super Admin |

لم يتغيّر أي توقع في `core/test_session_policy.py` ولا في `core/test_terminations_workflow.py`.

---

## 7. قرارات المالك

كان هذا القسم سابقًا قائمة أسئلة مفتوحة. **حُسمت كلها بقرار المالك في 2026-11-16** وهي مثبَّتة هنا كي لا يُعاد فتحها:

| # | الموضوع | قرار المالك | أثره التنفيذي |
| --- | --- | --- | --- |
| 1 | حادثة الـ migration على قاعدة التطوير (البند 2.5) | **«القاعدة تبقى كما هي بـ 0157 و 0158 مطبَّقتين»، والمالك يتولّى الأمر بنفسه** | لا عكس ولا `migrate` ولا أي أمر على قاعدة البيانات مني. لم يُعكَس شيء ولم يُطبَّق شيء بعد القرار |
| 2 | تعديلات المراحل 1–4 في الباك إند (القسم 4) | **«تبقى، وسأراجعها وأودعها بنفسي»** | لا `git add` ولا `git commit` ولا `git push` مني في الباك إند — والأعمال باقية في شجرة العمل كما هي |
| 3 | ملفات `deploy/` المحذوفة (41 ملفًا) | **«اتركها كما هي»** — لا استرجاع ولا إيداع | لا مسّ بها. وهي ملفات إصدارات قديمة: `deploy/DeltonCore_Setup_v1.1.6-r6_Portable/` و`deploy/installer/patches/v1.1.6…v1.2.7`. و`1.4` (بتعديلاته `1.4.3` و`1.4.4`) هو **إصدار نظام الـ HR نفسه** الذي تحمل ملفات التثبيت في `deploy/` رقمه |

**قيد مستمر بأمر المالك:** «ممنوع تعدل حاجة نهائي في الباك إند قبل ما تطلب مني». أي تعديل في مجلد الباك إند — حتى `MOBILE_API.md` — أو في قاعدة بياناته يحتاج إذنًا صريحًا لكل تغيير على حدة. **العمل الجاري محصور في تطبيق الموبايل** (`D:\MOBLIE APP Deltoncore`).

**ما بقي مفتوحًا فعلًا (لم يُطلب قراره بعد):**

1. **وضع `multi`** (القسم 5): هل يُفتح عمل لاحق لإلغاء الوصول على مستوى الشركة، أم يُترك لحين تفعيل `TENANCY_MODE=multi` في الإنتاج؟
2. **مجلد `graphify-out/`** غير المتتبَّع في الباك إند: ليس من عمل هذا البرومبت ولم أمسّه — متروك للمالك.

---

## ملحق: ما يودَع في مستودع التطبيق

commit محلي واحد فقط (بلا `push`) يضمّ: `src/api/types.ts`، `src/api/client.ts`، `src/api/mock.ts`، `src/api/__tests__/client.test.ts`، وملف البرومبت `Claude outputs/prompt-builder-08-security-sessions.md`، وهذا التقرير بنسخته النهائية التي تحمل قرارات القسم 7 — بلا أي تغيير في سلوك الشاشات.
