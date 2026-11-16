# تهيئة مشروع تطبيق المشرفين — شغّله مرة واحدة فقط
#
#   cd "D:\MOBLIE APP Deltoncore"
#   powershell -ExecutionPolicy Bypass -File .\bootstrap.ps1
#
# لماذا سكربت ولا ملف package.json جاهز: أرقام إصدارات حزم Expo لازم تطابق
# إصدار الـ SDK المثبَّت، والمطابقة دي بتعملها أداة expo نفسها. أي أرقام
# أكتبها أنا هتقدم عليها وتتعارض. فالسكربت ينشئ المشروع بالأداة الرسمية
# ويحافظ على كودنا فوقه.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

Write-Host "`n[1/5] نقل الكود جانبًا مؤقتًا..." -ForegroundColor Cyan

$keep = Join-Path $root '_keep'
New-Item -ItemType Directory -Force -Path $keep | Out-Null

foreach ($item in @('App.tsx', 'src', 'SETUP.md', 'app.json', '.env.example')) {
    $p = Join-Path $root $item
    if (Test-Path $p) {
        Move-Item -Path $p -Destination $keep -Force
    }
}

Write-Host "[2/5] إنشاء مشروع Expo (قد يستغرق دقائق)..." -ForegroundColor Cyan

# create-expo-app يرفض العمل في مجلد فيه ملفات، فالخطوة السابقة أفرغته.
npx --yes create-expo-app@latest . --template blank-typescript
if ($LASTEXITCODE -ne 0) { throw "فشل إنشاء المشروع" }

Write-Host "[3/5] استرجاع كودنا فوق القالب..." -ForegroundColor Cyan

Copy-Item -Path (Join-Path $keep '*') -Destination $root -Recurse -Force
Remove-Item -Path $keep -Recurse -Force

Write-Host "[4/5] تثبيت الحزم بالإصدارات المطابقة للـ SDK..." -ForegroundColor Cyan

npx expo install `
    expo-linear-gradient `
    expo-secure-store `
    expo-location `
    expo-crypto `
    expo-splash-screen `
    react-native-safe-area-context `
    @expo-google-fonts/ibm-plex-sans-arabic
if ($LASTEXITCODE -ne 0) { throw "فشل تثبيت الحزم" }

Write-Host "[5/5] إعداد ملف البيئة..." -ForegroundColor Cyan

$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $root '.env.example') $envPath
    Write-Host "      أُنشئ .env من المثال — عدّل EXPO_PUBLIC_API_BASE لما الباك إند يجهز." -ForegroundColor Yellow
}

Write-Host "`nتم. شغّل الآن:" -ForegroundColor Green
Write-Host "  npx expo start`n" -ForegroundColor Green
Write-Host "افتح التطبيق على موبايل أندرويد بـ Expo Go. الخادم الوهمي شغّال،"
Write-Host "فتقدر تدخل بأي اسم مستخدم وتمشي في كل الشاشات بدون باك إند."
Write-Host "اكتب 'wrong' في خانة كلمة المرور لتجربة شاشة الخطأ.`n"
