# تقرير برومبت 07 — تشغيل تطبيق المشرفين واستكماله وربطه بالباك إند

- **التطبيق:** `D:\MOBLIE APP Deltoncore` (Expo SDK 58 / RN 0.88.1 / React 19.3.0 / TS 6.0.3)
- **الباك إند المرجعي:** `D:\trae project\delton-hr-erp_clean` — قراءة فقط. الملف الوحيد الذي مُسَّ فيه هو `MOBILE_API.md` (المرحلة 8)، وبلا أي `git add`/`commit`/`push`.
- **التاريخ:** 2026-11-16
- **حالة Git:** مستودع محلي في مجلد التطبيق فقط، بلا remote، وcommit واحد هو `1745a78` (المرحلة 1). كل عمل المراحل 2–9 **غير مُودَع** حتى الآن.

---

## 1. ما تم (مرحلة بمرحلة)

### المرحلة 1 — التشغيل لأول مرة
- شُغّل `bootstrap.ps1` فأنشأ `node_modules`، وأُضيف `expo-crypto` عبر `npx expo install` (`~58.0.8` في `dependencies`).
- أُنشئ مستودع Git محلي في مجلد التطبيق فقط، مع `.gitignore` يستثني `node_modules/` و`.env` و`android/` و`ios/`، وبلا أي remote. الـ commit الأول `1745a78`.

### المرحلة 2 — الدخول: الجهاز الموثوق والتحقق بخطوتين
- `device_id`: UUID يُولَّد مرة واحدة بـ `Crypto.randomUUID()` ويُخزَّن في SecureStore، ويُرسل مع `platform: "android"` في كل دخول.
- `device_secret`: يُحفظ في SecureStore متى ورد في استجابة الدخول (يُصدَر/يُدوَّر مرة واحدة)، ويُرسل مع `device_id` في كل دخول لاحق.
- [TwoFactorScreen.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/screens/TwoFactorScreen.tsx): إدخال 6 أرقام مع خيار «استخدم رمزًا احتياطيًا»؛ تُعاد نفس بيانات الدخول مضافًا إليها `totp_code` أو `backup_code`. كلمة المرور تبقى في الذاكرة فقط حتى تنتهي الخطوة ولا تُخزَّن.
- أُضيف إلى `ApiErrorCode` و`messageFor`: `two_factor_required`, `two_factor_invalid`, `two_factor_enrollment_required` (ورسالته: التفعيل من نسخة الويب)، `missing_refresh_token`, `invalid_refresh_token`.
- [mock.ts](file:///d:/MOBLIE%20APP%20Deltoncore/src/api/mock.ts) يدعم الآن حسابات: `twofa`/`two.fa` (رمز `123456` أو `BACKUP-0001`)، و`enroll`، و`multico`.

### المرحلة 3 — تسجيل الخروج وإلغاء الجهاز
- `api.logout()` يرسل في الجسم `{ refresh, device_id }`.
- `unregisterDevice` صار `DELETE /devices/<device_id>/` بدل `DELETE /devices/?device_id=`.
- الخروج يمسح محليًا access + refresh + `device_secret`، ويُبقي `device_id`؛ والمسح يحدث في كل الأحوال ولو فشلت الشبكة، فلا يُحبَس المستخدم داخل التطبيق.
- صُحّح التعليق في [AuthContext.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/auth/AuthContext.tsx) الذي كان يدّعي أن السيرفر يلغي الجهاز تلقائيًا.

### المرحلة 4 — متانة العميل
في [client.ts](file:///d:/MOBLIE%20APP%20Deltoncore/src/api/client.ts):
- `newIdempotencyKey()` صار `Crypto.randomUUID()` بدل `Math.random`.
- إعادة محاولة على `429` و`503` وأخطاء الشبكة: تأخير متصاعد مع عشوائية (أساس 400ms، سقف 3000ms)، بحد أقصى 3 محاولات (`MAX_ATTEMPTS`). تُطبَّق على `GET` وعلى الكتابة التي تحمل `Idempotency-Key` **بنفس المفتاح**، ولا تُطبَّق على الدخول (`noSessionHandling`).
- مهلة 15 ثانية لكل طلب بـ `AbortController`، وكود `timeout` برسالة عربية.
- أكواد الصندوق `invalid_reason`, `no_permission`, `state_conflict`؛ وعند `state_conflict` تُعرض الرسالة ثم يُستدعى `onDecided` تلقائيًا بعد 1.8 ثانية لتحديث الصندوق.

### المرحلة 5 — نواقص تجربة أندرويد
- `BackHandler` في [AppNavigator.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/navigation/AppNavigator.tsx): شاشة مدفوعة → السابقة؛ تبويب غير الرئيسية → الرئيسية؛ الرئيسية → خروج. ومتى كان هناك تعديل غير محفوظ (سبب رفض/جزاء) يُسأل أولًا عبر `Alert.alert('تجاهل التغييرات؟', …)`، وشاشة اختيار الموظف المتداخلة تُغلق أولًا بلا سؤال.
- سياسة كلمة السر: `force_change` → شاشة حاجبة [PasswordChangeRequiredScreen.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/screens/PasswordChangeRequiredScreen.tsx) توجّه للويب مع زر خروج؛ و`days_until_expiry <= 7` → لافتة تحذير في الرئيسية (`PASSWORD_WARN_DAYS = 7`).
- المساحات الآمنة: الرأس يستخدم `useSafeAreaInsets` في [ui.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/components/ui.tsx)، وشريط التبويبات `paddingBottom: insets.bottom + spacing.sm`.
- الضغط المزدوج: أزرار البصمة والاعتماد والرفض وحفظ الجزاء تُعطَّل أثناء الإرسال.
- `refreshSession` يُستدعى عند عودة التطبيق للمقدمة (`AppState === 'active'`).

### المرحلة 6 — الشركات المتعددة
- `companies?: CompanyCard[]` أُضيف إلى استجابة الدخول، و`company?` إلى `SessionPayload`.
- شركة واحدة: لا تتغير التجربة إطلاقًا (لا شاشة اختيار ولا زر تبديل).
- أكثر من شركة أو `COMPANY_REQUIRED`: [CompanyPickerScreen.tsx](file:///d:/MOBLIE%20APP%20Deltoncore/src/screens/CompanyPickerScreen.tsx) ببطاقة لكل شركة، ثم `POST /auth/select-company/` وتخزين الزوج الجديد.
- «تبديل الشركة» يظهر فقط لمن له أكثر من شركة، ويُمرَّر معه الـ Bearer access token — وهو ما يقبله `tenancy/mobile.py:_central_from_bearer` فعلًا، فلا كلمة مرور عند التبديل. وعند التبديل تُمسح البيانات المعروضة قبل تحميل الجديدة.
- `COMPANY_FORBIDDEN`, `COMPANY_ARCHIVED`, `COMPANY_UNAVAILABLE` بثلاث رسائل عربية، وضُبطت حسبها `API_ERROR_CODES`.

### المرحلة 7 — الإشعارات
- أُزيل `expo-notifications` و`expo-device` من `bootstrap.ps1`، ولا وجود لأي منهما في `package.json`، ولا إذن `POST_NOTIFICATIONS` في `app.json` (الأذونات: موقع أمامي فقط، و`ACCESS_BACKGROUND_LOCATION` محجوب).
- Polling فقط عبر `useBadge` كل 60 ثانية وفي المقدمة فقط.
- `api.registerDevice` باقٍ بالدالة والنوع في العميل، وبلا أي استدعاء في هذا الإصدار.
- لا مسار لقائمة إشعارات في `core/mobile/urls.py` (لا يوجد إلا `/notifications/badge/`) → لم تُبنَ شاشة إشعارات.

### المرحلة 8 — الوثائق والعقد
- `MOBILE_API.md`: صُحّحت الأقسام 9.1–9.3 و10.1–10.2 و11 و12.1–12.2 لتطابق `core/mobile/views.py` و`requests_index.py` (`decision` لا `action`، `status` لا `tab`، استجابة التفاصيل مسطّحة بلا `base`، `check_in`/`check_out`، `/penalties/`، `penalty_date` و`reason`، نجاح الجزاء 200 لا 201، حجم الصفحة ثابت 20…). التعديل بلا commit كما اشترط البرومبت.
- `Claude outputs/MOBILE_CONTRACT.ts` أُعيد كتابته ليطابق `src/api/types.ts` بلا فرق.
- `SETUP.md` حُدِّث: قسم «لماذا Expo»، فقرة `app.json`، حسابات الخادم الوهمي، قسم **الإشعارات** الجديد، جدول الملفات، وقسم «ما لم يُبنَ بعد».

### المرحلة 9 — الاختبارات والتحقق
- أُضيف Jest: `jest@30.5.2`, `jest-expo@58.0.14`, `@types/jest@30.0.0` في `devDependencies`، وسكربت `npm test`، وإعداد `preset: jest-expo` في `package.json`، و`"types": ["jest","node"]` في `tsconfig.json` (بدونه لم يكن TS يرى أنواع Jest — راجع §2).
- [client.test.ts](file:///d:/MOBLIE%20APP%20Deltoncore/src/api/__tests__/client.test.ts): 6 اختبارات (التفاصيل في §2).
- تحقق نهائي: `npx tsc --noEmit` نظيف، و`npx expo export --platform android` يبني الحزمة.
- بناء APK: **متعذّر على هذا الجهاز** لغياب JDK وAndroid SDK — التفاصيل في §2 و§3.

---

## 2. ما تحقّقت منه فعلًا

كل ما في هذا القسم شُغِّل هنا ونتيجته منقولة كما ظهرت.

| الأمر | النتيجة |
| --- | --- |
| `npx tsc --noEmit` | exit code 0، بلا أي خطأ |
| `npx jest` | `Test Suites: 1 passed, 1 total` — `Tests: 6 passed, 6 total` |
| `npx expo export --platform android --output-dir dist` | `Android Bundled 4824ms index.ts (662 modules)` ثم `Exported: dist`، exit code 0 |
| `npx expo prebuild --platform android --no-install` | exit code 0: `✔ Created native directory` ثم `✔ Finished prebuild`، مع تحذيرين فقط (أدناه) |
| `.\gradlew.bat assembleDebug` | exit code 9009: `ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.` |
| فحص بيئة أندرويد | `ANDROID_HOME` و`ANDROID_SDK_ROOT` و`JAVA_HOME` فارغة، ولا `adb` ولا `gradle` ولا `java`، ولا أي من `%LOCALAPPDATA%\Android\Sdk` أو `C:\Android\Sdk` أو Android Studio |

الاختبارات الستة التي تمر:

1. عشرة ردود `401` متزامنة تُطلق نداء تجديد **واحدًا** (وتُحدَّث الجلسة المخزَّنة).
2. فشل التجديد يُسقط الجلسة محليًا: يُمسح access و refresh، ويُستدعى `onSessionLost` مرة واحدة.
3. إعادة الكتابة بعد `429` ترسل **نفس** `Idempotency-Key` في المحاولتين.
4. كتابة لا تحمل `Idempotency-Key` (مثل `/logout/`) لا تُعاد عند `503` — نداء واحد فقط.
5. `messageFor` يعطي نصًّا عربيًا لكل قيمة في `API_ERROR_CODES`، ويختلف عن الرسالة الافتراضية لكل كود إلا `unknown` المقصود. أي كود جديد بلا رسالة يُسقط الاختبار.
6. الفشل غير `ApiFailure` (انقطاع الشبكة) يعطي رسالة «تعذّر الاتصال…».

تحقّق ساكن للمسارات (قراءة `urls.py`، لا تشغيل):

- `core/mobile/urls.py` يحوي: `login/`, `token/refresh/`, `logout/`, `me/`, `devices/`, `devices/<str:device_id>/`, `notifications/badge/`, `requests/`, `requests/<slug:pk>/`, `requests/<slug:pk>/decide/`, `attendance/punch/`, `attendance/today/`, `site-employees/`, `penalties/form/`, `penalties/`.
- `tenancy/urls.py` يحوي `mobile/auth/select-company/`، وهو ما يطابق `POST {API_BASE}/auth/select-company/` في `client.ts` (`API_BASE` ينتهي بـ `/api/mobile`).

التحذيران اللذان أخرجهما `prebuild`:

- `androidStatusBar` صار مهملًا ولا أثر له؛ البديل هو إعداد إضافة `expo-status-bar`.
- `userInterfaceStyle` يحتاج `expo-system-ui` ليعمل على أندرويد.

(لذلك حذفت مجلد `android/` الذي أنشأه `prebuild`، وأعدت `scripts.android`/`scripts.ios` في `package.json` إلى `expo start --android` / `expo start --ios` بعد أن عدّلهما `prebuild` إلى `expo run:android`/`expo run:ios`. لم أُبقِ على أي أثر من الـ prebuild.)

---

## 3. ما كتبته ولم أختبره، وسبب عدم الاختبار

1. **تشغيل التطبيق فعلًا — ضد الخادم الوهمي أو ضد الباك إند.** لا يوجد جهاز ولا محاكي أندرويد على هذا الجهاز (لا `adb`، ولا Android SDK، ولا Java)، فلا سبيل لتشغيل التطبيق أصلًا. وعليه فشرط قبول المرحلة 2 (دخول عادي، ودخول مستخدم 2FA يمر بشاشة الرمز، ورمز خاطئ يعرض رسالته، ودخول ثانٍ من نفس الجهاز لا يطلب الرمز) **مكتوب ومُغطّى بمنطق الخادم الوهمي، ولم يُجرَّب في تطبيق يعمل**.
2. **بناء APK تجريبي.** `gradlew assembleDebug` مستحيل هنا: `ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH`. لم يُنفَّذ بعدها أي التفات؛ السبب بيئي لا برمجي.
3. **التشغيل ضد الباك إند المحلي (المرحلة 9/3).** لم أشغّل `run_servers.bat` لسببين: (أ) لا يمكن التحقق من التطبيق بلا محاكي، فالاختبار لن يكون كاملًا في كل الأحوال؛ (ب) السكربت يستعمل `.env` الموجود إن وُجد (`run_servers.bat` سطر 54)، ولم أقرأ هذا الملف ولم أعرف — التزامًا بقاعدة عدم لمس الإنتاج — ما إذا كان يشير إلى قاعدة بيانات إنتاج. أستطيع تشغيله على منفذ مخصص مع `USE_POSTGRES=False` و`SQLITE_DB` منفصل بعد قرارك.
4. **كل ما هو بصري-تفاعلي:** المساحات الآمنة، اتجاه RTL الفعلي، سلوك زر الرجوع، تعطيل الأزرار أثناء الإرسال، شاشة اختيار الشركة، لافتة كلمة المرور. كُتبت وتُراجعت قراءةً، ولم تُرَ على شاشة.
5. **توافق `.env` الحالي:** الملف يحمل `EXPO_PUBLIC_USE_MOCK=1` و`EXPO_PUBLIC_API_BASE=https://hr.example.com/api/mobile` (وهو العنوان الافتراضي نفسه في `client.ts`). لم يُغيَّر.

---

## 4. اختلافات وجدتها بين التطبيق والباك إند (لم تكن في البرومبت)

1. **أسماء أكواد تجديد الجلسة.** البرومبت طلب `invalid_refresh` و`missing_refresh`؛ والكود الفعلي يستعمل `invalid_refresh_token` (401) و`missing_refresh_token` (400) — في `core/mobile/views.py:293/324/326` و`tenancy/mobile.py:267/268`. التطبيق يستعمل الاسمين الحقيقيين، والأسماء الوهمية التي في البرومبت غير موجودة في الباك إند.
2. **`COMPANY_REQUIRED` بحالتين مختلفتين.** من `POST /login/` في وضع تعدد الشركات يعود **HTTP 200** بجسم يحمل `companies` و`selection_token` بلا أي JWT (`tenancy/mobile.py:223`)، لا 409 كما تقول docstring الملف نفسه في سطره 12. أما 409 فتصدر من `tenancy/middleware.py` (أسطر 143/169/175) لطلب مصادق عليه بلا سياق شركة. التطبيق يتعامل مع الحالتين.
3. **`device_secret` معطَّل في وضع تعدد الشركات.** `tenancy/mobile.py:13-14` يوضح أن جدول الأجهزة الموثوقة محلي داخل الشركة، فالمستخدم المسجَّل في 2FA يُطلب منه الرمز في **كل** دخول في هذا الوضع. أي أن شرط «الدخول الثاني من نفس الجهاز لا يطلب الرمز» يتحقق في وضع الشركة الواحدة فقط.
4. **حالات HTTP للدخول تختلف عمّا يُتوقّع:** `invalid_credentials` → 400، `account_inactive` → 401، `password_locked` → 423 (وبجسمه `password_policy`). التطبيق يعالجها، و`noSessionHandling` على الدخول يمنع تفسير 401 بأنه جلسة منتهية فتتكرر مطالبة الرمز بلا فائدة.
5. **أخطاء DRF بلا حقل `code`.** `tenancy/drf.py` يرفع `AuthenticationFailed(..., code='company_context_invalid')` و`code='user_inactive'`، وDRF يرسم الجسم `{"detail": "..."}` فقط، فيسقط التطبيق إلى `unknown` ويعرض الرسالة العامة (ويُسقط الجلسة لأن الحالة 401). النتيجة آمنة لكنها غير مشروحة للمستخدم.
6. **`LocationStatus`.** مسار البصمة يُصدر `verified` و`no_coordinates` و`no_gps` فقط؛ و`not_enforced` باقٍ في النوع كاحتياط لم أجد ما يُصدره، وقد علّقت ذلك في `src/api/types.ts`.
7. **لا `per_page`.** حجم الصفحة ثابت `_PAGE_LIMIT = 20` (`core/mobile/views.py:529`)، و`page` مُحترم، و`next` رقم الصفحة التالية أو `null`. التطبيق يرسل `page` فقط.
8. **لا مسار لتغيير كلمة المرور تحت `/api/mobile/`.** الموجود هو `/api/auth/change-password/` للتطبيق الويب (`core/api_urls.py:51`). فشاشة `force_change` توجّه للويب كما طلب البرومبت، ولم تُبنَ شاشة تغيير.
9. **إعدادات `app.json`:** `androidStatusBar` مهمل بلا أثر، و`userInterfaceStyle: "dark"` لا يعمل على أندرويد بلا `expo-system-ui`. الأثر محدود لأن التطبيق يفرض الثيم الداكن من `tokens.ts`، لكن الإعداد يستحق تنقية.
10. **`typeRoots` / أنواع Jest:** في هذا المشروع لم يكن TypeScript يضمّ `@types` تلقائيًا (ظهر فقط `@types/react`)، فتطلّب الأمر `"types": ["jest","node"]` صراحةً في `tsconfig.json` وإلا سقط `tsc` على أسماء Jest.

---

## 5. تغييرات مطلوبة في الباك إند (لم تُنفَّذ)

1. **تصحيح docstring `tenancy/mobile.py` سطر 12**: الدخول متعدد الشركات يعيد `COMPANY_REQUIRED` بـ **200** وليس 409؛ والـ 409 تأتي من `tenancy/middleware.py`.
2. **جدول ثقة أجهزة مركزي**: ليعمل `device_secret` في وضع تعدد الشركات بدل مطالبة المستخدم برمز 2FA في كل دخول.
3. **حقل `code` في أجسام أخطاء DRF** (`tenancy/drf.py` وما يشبهه) حتى تصل `company_context_invalid` و`user_inactive` كحقل يمكن للعميل التبديل عليه بدل نص `detail` المجرَّد.
4. **`page_size` اختياريًا** في `/requests/`: حاليًا حجم ثابت 20.
5. **مسار قائمة إشعارات تحت `/api/mobile/`**: لا يوجد إلا `/notifications/badge/`؛ بناء شاشة إشعارات ينتظره.
6. **مسار موبايل لتغيير كلمة المرور**: بديل عن توجيه المستخدم إلى نسخة الويب عند `force_change` أو عند اقتراب الانتهاء.
7. **`MOBILE_API.md`**: يعرّف الآن `COMPANY_REQUIRED` بـ 200 من الدخول و409 من الـ middleware؛ يُستحسن أن تُصحَّح معه docstring الكود ليتفقا.

---

## 6. أسئلة تحتاج قرار المالك

1. **تعدد الشركات + 2FA**: المستخدم المسجَّل في 2FA يقدّم رمزًا في كل دخول في وضع تعدد الشركات (بند 4.3). هل هذا مقبول للمشرفين ميدانيًا، أم ننتظر جدول ثقة مركزيًا في الباك إند؟
2. **`force_change`**: هل يكفي توجيه المستخدم إلى النسخة الويب (الوضع الحالي ونصّ البرومبت)، أم تريد مسار تغيير كلمة مرور داخل التطبيق فيتطلب إضافة مسار في الباك إند؟
3. **الخادم الوهمي**: أُبقي `EXPO_PUBLIC_USE_MOCK=1` في `.env` كما هو، أم أُطفئه وأوجّه `EXPO_PUBLIC_API_BASE` إلى خادم التطوير؟
4. **عتبة تحذير كلمة المرور**: نفّذت «أقل من أو يساوي 7» حرفيًا (`<= 7`). هل تريد رقمًا آخر؟
5. **Git**: نفّذت commit واحدًا في المرحلة 1 فقط (`1745a78`). كل عمل المراحل 2–9 وهذا التقرير غير مُودَع. أنفّذ الآن commit واحد للتطبيق يضمّها كلها؟
