> برومبت البلدر رقم 1 — أساس الـ API للموبايل. الصقه كما هو.

---

أنت شغّال على كود **Delton Core People** (`delton-hr-erp`، Django 6.0.2، تطبيقا `core` و`reports`).

سيُبنى تطبيق موبايل أندرويد لمشرفي المواقع والمعتمِدين، يستهلك هذا الباك إند عبر مسارات جديدة تحت `/api/mobile/`. هذه المهمة هي **الأساس فقط**: المصادقة والأمان وهيكل المسارات. لا تبنِ صندوق الطلبات ولا التحقق الجغرافي ولا الإشعارات في هذه المهمة.

## قواعد حاكمة

1. **لا تلمس أي مسار أو view أو template خاص بالديسكتوب.** كل الكود الجديد في ملفات جديدة. المسارات الحالية تبقى كما هي حرفيًا.
2. **لا تكرّر منطق أعمال موجود.** أي شيء تحتاجه (فحص الصلاحيات، ربط المستخدم بالموظف، سياسة كلمة السر) استدعِ الدالة الموجودة ولا تعِد كتابتها.
3. كل migration قابل للعكس، ولا يغيّر جدولًا قائمًا إلا بإضافة حقول اختيارية.
4. اكتب اختبارات لكل نقطة نهاية جديدة ولكل حالة رفض مذكورة أدناه.
5. لو وجدت أن أحد الافتراضات في هذا البرومبت لا يطابق الكود، **توقف واذكر التعارض** بدل أن تخمّن.

## البنية المطلوبة

أنشئ:

- `core/mobile/__init__.py`
- `core/mobile/auth.py` — المصادقة وفحوص الحساب
- `core/mobile/views.py` — نقاط النهاية
- `core/mobile/urls.py` — المسارات
- `core/mobile/idempotency.py` — بنية منع التنفيذ المزدوج
- `core/mobile/models.py` أو أضف النماذج إلى `core/models.py` حسب ما يناسب بنية التطبيق الحالية (اذكر أيهما اخترت ولماذا)
- `core/mobile/tests/` — الاختبارات

وسجّل المسار في `hr_pro_system/urls.py` بسطر واحد: `path('api/mobile/', include('core.mobile.urls'))`، دون المساس بباقي السطور.

## 1. إعدادات HTTPS

لا توجد أي إعدادات `SECURE_*` في `hr_pro_system/settings.py` حاليًا. أضفها **مقروءة من متغيرات البيئة بقيم افتراضية آمنة للتطوير**، بحيث لا تكسر التشغيل المحلي على HTTP:

- `SECURE_SSL_REDIRECT`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`
- `SECURE_HSTS_SECONDS` و`SECURE_HSTS_INCLUDE_SUBDOMAINS`
- `SECURE_PROXY_SSL_HEADER` (لأن النشر سيكون خلف reverse proxy)

اجعلها كلها تُفعَّل تلقائيًا عندما `DEBUG=False`، وأضف ملاحظة في `.env.example` بالقيم المطلوبة للإنتاج.

## 2. مسارات الـ Token

`djangorestframework-simplejwt` مثبّت ومضبوط كـ `DEFAULT_AUTHENTICATION_CLASSES`، لكن **لا توجد أي مسارات token مسجّلة**. أضف تحت `/api/mobile/`:

- `POST /api/mobile/token/refresh/` — تجديد الـ access token
- `POST /api/mobile/logout/` — إبطال الـ refresh token وإلغاء تسجيل الجهاز (الجهاز سيأتي في مهمة لاحقة؛ اتركه نقطة تمديد واضحة)

عدّل `SIMPLE_JWT` في settings ليكون:
- `ACCESS_TOKEN_LIFETIME` = ساعة واحدة
- `REFRESH_TOKEN_LIFETIME` = 14 يومًا
- `ROTATE_REFRESH_TOKENS` = True مع `BLACKLIST_AFTER_ROTATION` = True

فعّل `rest_framework_simplejwt.token_blacklist` في `INSTALLED_APPS` لأن تسجيل الخروج يحتاجه.

## 3. مسار الدخول للموبايل

`POST /api/mobile/login/` — يأخذ `username` و`password`.

يجب أن يعيد استخدام كل ما يفعله `login_view` الحالي (`core/api_views.py:1550`) من فحوص: سياسة كلمة السر عبر `get_password_policy_status`، وتحديد معدل المحاولات، وكتابة سجل التدقيق. الفرق الوحيد أنه **يصدر JWT بدل إنشاء جلسة** — لا تستدعِ `django.contrib.auth.login()` هنا.

**شكل الاستجابة عند النجاح (التزم به حرفيًا — تطبيق الموبايل يُبنى عليه):**

```json
{
  "access": "<jwt>",
  "refresh": "<jwt>",
  "user": { "id": 12, "username": "ahmed.s", "full_name": "أحمد سيد" },
  "employee": {
    "id": 340,
    "employee_number": "EMP-00340",
    "full_name_ar": "...",
    "job_title": "...",
    "department": "..."
  },
  "site": { "id": 4, "name_ar": "...", "name_en": "..." },
  "permissions": ["core.can_manage_site_attendance", "core.can_approve_penalties"],
  "capabilities": {
    "can_punch": true,
    "can_approve": true,
    "can_create_penalty": true,
    "is_site_supervisor": true
  },
  "password_policy": { "force_change": false, "days_until_expiry": 12 }
}
```

ملاحظات على الحقول:

- `employee` يُجلب عبر `_resolve_user_employee` الموجودة في `core/api_views.py:1012` (تجرب العلاقة ثم `employee_number == username` كخطة احتياطية).
- `site` من `employee.site`. اتركه `null` لو الموظف بلا موقع.
- `permissions` بصيغة `app_label.codename` الكاملة، لا الصيغة القديمة المجرّدة. اجمعها من صلاحيات المستخدم ومجموعاته.
- `capabilities` هي المهمة: **تطبيق الموبايل لن يعرف أسماء الصلاحيات إطلاقًا**، سيقرأ هذه الأعلام فقط. احسبها من الصلاحيات:
  - `can_punch` = يملك `core.can_manage_site_attendance` أو `core.change_attendance`
  - `can_approve` = يملك أيًا من `core.can_approve_requests` أو `core.can_approve_loans` أو `core.can_approve_missions` أو `core.can_approve_penalties`
  - `can_create_penalty` = يملك `core.add_penaltyrecord` أو `core.can_manage_penalties`
  - `is_site_supervisor` = عبر `_is_site_supervisor` الموجودة في `core/api_views.py:1322`
  - أضف `is_superuser` كعلم منفصل إن رأيته مفيدًا.

**حالات الرفض المطلوبة، كل واحدة بكود نصي ثابت في جسم الاستجابة:**

| الحالة | الكود | HTTP |
| --- | --- | --- |
| بيانات دخول خاطئة | `invalid_credentials` | 400 |
| الحساب مقفول بسياسة كلمة السر | `password_locked` | 423 |
| محاولات كثيرة | `too_many_attempts` | 429 (مع `retry_after_seconds`) |
| الحساب غير نشط (`is_active=False`) | `account_inactive` | 401 |
| المستخدم بلا سجل موظف مرتبط | `no_employee_profile` | 403 |
| المستخدم لا يملك أي صلاحية تخص التطبيق | `no_mobile_access` | 403 |

آخر حالتين مهمتان: `Employee.user` حقل اختياري، فقد يوجد مستخدم بلا موظف — والتطبيق لا يعمل بدونه. والمستخدم بلا أي صلاحية موبايل يجب أن يُرفض عند الدخول لا أن يرى تطبيقًا فارغًا.

## 4. فحص الحساب في كل طلب — هذه أهم نقطة في المهمة

**المشكلة المكتشفة:** آليات إبطال الوصول الحالية (`SessionSecurityMiddleware` و`PasswordLifecycleMiddleware` في `core/middleware.py`) تعتمد على `request.session.flush()`. مع طلب يحمل `Authorization: Bearer <jwt>` لا توجد جلسة تُمسح، فالـ Token يظل صالحًا. **النتيجة العملية: موظف عُطِّل حسابه أو انتهت صلاحية كلمة سره يظل قادرًا على تسجيل الحضور واعتماد الطلبات من التطبيق حتى تنتهي مدة الـ Token.**

المطلوب: صنف مصادقة يرث `rest_framework_simplejwt.authentication.JWTAuthentication` ويفحص بعد التحقق من التوقيع:

1. `user.is_active` — وإلا `401` بكود `account_inactive`
2. `get_password_policy_status(user)` — لو `locked` فـ `401` بكود `password_locked`
3. وجود سجل موظف مرتبط — وإلا `403` بكود `no_employee_profile`

طبّقه على كل مسارات `/api/mobile/` فقط، ولا تغيّر المصادقة الافتراضية للنظام.

**وتأكد أيضًا** أن `SessionSecurityMiddleware` و`PasswordLifecycleMiddleware` لا يتدخلان في مسارات `/api/mobile/` بمسح جلسة غير موجودة أو بإعادة توجيه إلى `/login`. لو تدخّلا، استثنِ المسار صراحةً — دون تغيير سلوكهما تجاه الديسكتوب.

## 5. بنية منع التنفيذ المزدوج (Idempotency)

ستُستخدم لاحقًا في البصمة والاعتماد، وتُبنى الآن. السبب: اعتماد الإجازة يخصم الرصيد من `AnnualLeaveYear` ويكتب `LeaveBalanceEntry` في نفس المعاملة، فإعادة إرسال من الموبايل على شبكة ضعيفة تخصم الرصيد مرتين.

المطلوب:

- نموذج يخزّن: مفتاح العميل، المستخدم، المسار، بصمة جسم الطلب، الاستجابة المحفوظة، وقت الإنشاء. مع قيد تفرّد على (المفتاح، المستخدم).
- مُزخرِف (decorator) يُطبَّق على أي view كتابة: يقرأ ترويسة `Idempotency-Key`، فإن وُجد سجل بنفس المفتاح والمستخدم يعيد الاستجابة المحفوظة كما هي بترويسة تشير إلى أنها معادة، وإلا ينفّذ ويحفظ.
- لو وصل نفس المفتاح بجسم طلب مختلف، ارفض بـ `409` وكود `idempotency_key_reuse`.
- أمر `manage.py` لتنظيف السجلات الأقدم من 7 أيام.

**تنبيه:** اكتب سجل الـ Idempotency بعد نجاح المعاملة، لا داخلها، وإلا فقدته عند أي rollback. الأمر نفسه ينطبق على `_audit_write` — استخدم `transaction.on_commit` حيث يلزم.

## 6. نقطة نهاية للتحقق من الحياة

`GET /api/mobile/me/` — ترجع نفس محتوى استجابة الدخول عدا الـ tokens. التطبيق سيستدعيها عند كل فتح للتأكد أن الحساب ما زال صالحًا وأن الصلاحيات لم تتغير.

## المخرَج المطلوب

1. الكود والـ migrations والاختبارات.
2. ملف `MOBILE_API.md` في جذر المشروع يوثّق كل نقطة نهاية أُنجزت: المسار، الطريقة، جسم الطلب، جسم الاستجابة، وكل أكواد الأخطاء — بأمثلة JSON حقيقية من الاختبارات لا مخترعة.
3. سطر واحد في نهاية ردك يذكر أي افتراض في هذا البرومبت لم يطابق الكود وكيف تصرفت.

## ما لا تفعله في هذه المهمة

صندوق الطلبات، التحقق الجغرافي، إشعارات FCM، تسجيل الأجهزة، أي تعديل على نماذج الطلبات الأربعة، وأي تعديل على شاشات الديسكتوب.
