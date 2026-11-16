> برومبت البلدر رقم 4 — مسارات `/api/mobile/`. الصقه كما هو.

---

أنت شغّال على كود **Delton Core People** (`delton-hr-erp`، Django 6.0.2، تطبيقا `core` و`reports`).

هذه المهمة تبني نقاط النهاية التي يستهلكها تطبيق الموبايل. تعتمد على ما أُنجز في المهام السابقة: بنية `core/mobile/` والمصادقة و`Idempotency` (المهمة 1)، والتحقق الجغرافي (المهمة 2)، وطبقة فهرسة الطلبات `ApprovalRequest` (المهمة 3).

**تطبيق الموبايل مكتوب بالفعل ضد هذه الأشكال.** أي انحراف في اسم حقل أو شكل استجابة يكسر شاشة جاهزة، فلا تُعد تسميتها ولا تُحسّنها. لو رأيت شكلًا خاطئًا، قل ذلك في ردك ولا تغيّره من طرفك.

## قواعد حاكمة

1. كل مسار جديد تحت `/api/mobile/`. لا تلمس مسارات الديسكتوب.
2. **كل مسار كتابة يغلّف الـ view الموجود ولا يكرر منطقه.** الاعتماد يستدعي `leave_request_approve` وأخواتها؛ البصمة تستدعي `attendance_punch`. الآثار الجانبية (خصم رصيد الإجازة، سجل التدقيق) تبقى في مكان واحد.
3. كل مسار يستدعي `_enforce_site_supervisor_site` أو `_enforce_site_supervisor_employee` حسب ما يناسب. تسريب بيانات موقع آخر عيب أمني لا خطأ عرض.
4. كل مسار كتابة يمر بمُزخرِف الـ `Idempotency` المبني في المهمة 1.
5. اختبارات لكل مسار ولكل كود رفض.
6. لو خالف افتراض هنا الكودَ، **قف واذكر التعارض**.

## 1. صندوق الطلبات

### `GET /api/mobile/requests/`

معاملات: `status` بقيمة `pending` أو `decided`، و`type` بأحد `leave` `loan` `mission` `penalty`، و`page`.

`pending` تعني `current_approver = request.user AND status = 'pending'`. `decided` تعني ما بتّ فيه هذا المستخدم (عبر `ApprovalAction.actor`).

**شكل الاستجابة — التزم به حرفيًا:**

```json
{
  "results": [
    {
      "id": 901,
      "request_type": "leave",
      "status": "pending",
      "approval_level": 1,
      "employee": {
        "id": 412,
        "full_name_ar": "محمود عبد الرحمن حسن",
        "employee_number": "EMP-00412"
      },
      "title": "إجازة سنوية",
      "subtitle": "٣ أيام · من ٢٢ سبتمبر",
      "source_created_at": "2026-09-19T10:42:00Z"
    }
  ],
  "count": 7,
  "next": 2
}
```

`next` هو **رقم الصفحة التالية أو `null`**، لا رابطًا. هذا يخالف افتراضي DRF، فإن استخدمت pagination جاهزًا فاضبطه.

`title` و`subtitle` يأتيان من سجل دوال العرض لكل نوع المبني في المهمة 3. التطبيق يعرضهما كما هما ولا يفسّرهما.

### `GET /api/mobile/requests/<id>/`

نفس الحقول أعلاه زائد:

```json
{
  "details": [
    { "label": "نوع الإجازة", "value": "سنوية" },
    { "label": "المدة", "value": "٣ أيام" },
    { "label": "الرصيد بعد الاعتماد", "value": "٩ أيام" }
  ],
  "actions": [
    {
      "id": 44,
      "decision": "approved",
      "actor_name": "طارق محمود",
      "reason": "",
      "level": 1,
      "client_source": "desktop",
      "decided_at": "2026-09-18T09:10:00Z"
    }
  ],
  "next_step": "بعد اعتمادك ينتقل إلى الموارد البشرية"
}
```

`next_step` جملة عربية واحدة تقول ماذا يحدث بعد الاعتماد، أو `null` لو كان هذا آخر مستوى. **لا ترجعه لطلب مبتوت فيه.**

الوصول: يُسمح لمن هو `current_approver`، أو من بتّ فيه سابقًا، أو من يملك صلاحية عرض النوع مع كون الموظف في موقعه. غير ذلك `403`.

### `POST /api/mobile/requests/<id>/decide/`

الجسم: `{"decision": "approve"|"reject", "reason": "..."}`. السبب إلزامي عند الرفض — رفضه بـ `400` إن كان فارغًا.

**التنفيذ:** استدعِ view الاعتماد الأصلي للنوع (`leave_request_approve` / `loan_approve` / `mission_hod_approve` أو `mission_hr_approve` حسب المستوى / `penalty_approve`)، ثم اكتب صف `ApprovalAction` بـ `client_source='app'`. **لا تكتب منطق اعتماد جديدًا.**

المستوى في الإذن يحدد أي view يُستدعى: `approval_level = 1` تعني HOD، و`2` تعني HR.

يعيد شكل التفاصيل الكامل بعد التنفيذ، ليحدّث التطبيق الشاشة بلا طلب ثانٍ.

رفض بـ `403` لو المستخدم ليس `current_approver`. رفض بـ `409` لو الطلب لم يعد `pending` — شخص آخر بتّ فيه من الديسكتوب بينما الشاشة مفتوحة، وهذه حالة واقعية لا نادرة.

## 2. الحضور

### `POST /api/mobile/attendance/punch/`

الجسم:

```json
{
  "employee_id": 340,
  "attendance_type": "check_in",
  "latitude": 30.2841,
  "longitude": 31.7419,
  "accuracy_meters": 22,
  "is_mocked": false
}
```

**حقل `is_mocked` — أهم إضافة في هذه المهمة.**

تطبيقات تزييف الموقع على أندرويد على بُعد ضغطة، وهي أوضح طريقة لتزوير الحضور: الموظف يسجّل حضورًا وهو في بيته. التطبيق يرصدها ويرفض الإرسال، **لكن فحص العميل لا يُعتمد عليه إطلاقًا** — أي شخص يعدّل الـ APK ويزيل الفحص.

لذلك: وصول `is_mocked: true` إلى الخادم يعني أن التطبيق عُدِّل. المطلوب:

- ارفض بـ `400` والكود `location_mocked`. **لا تحفظ سجل حضور.**
- اكتب في `AuditLog` بفعل مميّز (مثل `attendance.mock_location_attempt`) يحمل المستخدم والموظف والإحداثيات والوقت.
- أضف هذه المحاولات إلى أمر `manage.py geofence_status` أو أمرًا خاصًا بها، لتراها الموارد البشرية.

ولا تكتفِ بذلك: `accuracy_meters` قيمة يرسلها العميل أيضًا، فهي قابلة للتزوير بنفس المنطق. التحقق الجغرافي يطرحها من المسافة، فقيمة كبيرة مزوّرة تُمرّر بصمة بعيدة. **ضع حدًا أعلى معقولًا** (مثل 200 مترًا) يُرفض ما فوقه بالكود `gps_inaccurate` بدل أن يُطرح من المسافة.

بقية التنفيذ: افرض `entry_source='mobile'`، وافرض `Employee.allowed_attendance_method` (رفض بالكود `attendance_method_not_allowed` لمن قيمته `machine_only`)، ثم مرّر إلى `attendance_punch` ليأخذ مجراه بالتحقق الجغرافي المبني في المهمة 2.

**الاستجابة عند النجاح:**

```json
{ "id": 7781, "ok": true, "location_status": "verified", "gps_distance_meters": 34 }
```

`location_status` بأحد `verified` `not_enforced` `no_coordinates` `no_gps`. `gps_distance_meters` قد يكون `null`.

### `GET /api/mobile/attendance/today/?employee_id=<id>`

```json
{
  "employee_id": 340,
  "last_punch": "check_in",
  "last_punch_at": "2026-09-20T06:12:00Z",
  "next_action": "check_out"
}
```

`next_action` هو ما يجب أن يفعله الزر التالي، محسوبًا بنفس منطق التسلسل الموجود في `attendance_punch` (آخر `check_in`/`check_out` في اليوم المحلي). `last_punch` يكون `null` إن لم يُسجَّل شيء اليوم، و`next_action` وقتها `check_in`.

## 3. موظفو الموقع

### `GET /api/mobile/site-employees/?site_id=<id>&q=<text>`

غلاف حول `attendance_site_employees` الموجود، بشكل استجابة مبسّط:

```json
{ "results": [{ "id": 412, "name": "محمود عبد الرحمن حسن", "employee_number": "EMP-00412" }] }
```

بدون أي حقل مالي.

## 4. الجزاءات

### `GET /api/mobile/penalties/form/`

كل ما تحتاجه شاشة تسجيل الجزاء في طلب واحد:

```json
{
  "penalty_types": [{ "id": 1, "name": "تأخير متكرر" }],
  "open_period": { "id": 92, "label": "سبتمبر ٢٠٢٦" },
  "max_days_before_review": 5
}
```

`open_period` يكون `null` إن لم توجد فترة محاسبية مفتوحة — الشاشة تعطّل النموذج بناءً عليه بدل أن يكتب المستخدم كل شيء ثم يُرفض.

### `POST /api/mobile/penalties/`

الجسم: `employee_id`، `penalty_type_id`، `days` (نص عشري)، `penalty_date`، `reason`.

`days` يصل كنص لا كعدد عشري عائم، لأنه أساس خصم في الرواتب. حوّله إلى `Decimal` مباشرةً ولا تمرّه عبر `float` إطلاقًا.

يحدد الفترة المحاسبية المفتوحة ويربط بها `PenaltyRecord`. لو لا توجد فترة مفتوحة، ارفض بـ `400` والكود `no_open_period`.

يُنشأ بحالة `approval_status='pending'` فيظهر في صندوق الطلبات عند المعتمِد المختص عبر طبقة الفهرسة.

الاستجابة: `{"id": 5512, "ok": true}`.

## 5. أكواد الرفض — القائمة المغلقة

التطبيق يترجم هذه الأكواد إلى رسائل عربية ويتصرف بناءً عليها. **لا تخترع كودًا خارج هذه القائمة**، ولا ترسل رسالة إنجليزية في `detail` متوقعًا أن تُعرض:

`invalid_credentials` · `password_locked` · `too_many_attempts` · `account_inactive` · `no_employee_profile` · `no_mobile_access` · `token_invalid` · `out_of_range` · `gps_inaccurate` · `gps_unavailable` · `location_mocked` · `period_closed` · `no_open_period` · `duplicate_punch` · `already_checked_in` · `not_checked_in` · `attendance_method_not_allowed` · `idempotency_key_reuse`

## المخرَج المطلوب

1. الكود والاختبارات.
2. تحديث `MOBILE_API.md` بكل مسار، بأمثلة JSON **مأخوذة من الاختبارات لا مكتوبة يدويًا**.
3. ناتج تشغيل الاختبارات ملصقًا في ردك.
4. سطر يذكر أي افتراض لم يطابق الكود وكيف تصرفت.

## ما لا تفعله

الإشعارات وتسجيل الأجهزة (مهمة منفصلة)، تقديم الطلبات من التطبيق، وأي تعديل على شاشات الديسكتوب أو منطق الاعتماد.
