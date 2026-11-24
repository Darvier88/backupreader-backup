# Deja listo el proyecto de pruebas (staging) sin ir clic a clic por la consola.
#
# Esta es la versión de PowerShell, para Windows. La de bash, para Mac y Linux,
# es `crear-staging.sh` y hace exactamente lo mismo. No se usa bash aquí a
# propósito: en Windows haría falta Git Bash y, aun así, `python3`, `base64` y
# `gsutil` no siempre están donde el guion los busca. PowerShell trae todo eso
# de serie.
#
# QUÉ HACE
# --------
#   1. Vincula la cuenta de facturación (Storage la exige).
#   2. Enciende las APIs que hacen falta.
#   3. Crea Firestore en la región que le digas.
#   4. Crea el bucket de Storage.
#   5. Activa el inicio de sesión con correo y contraseña.
#   6. Autoriza el dominio de staging, sin borrar los que ya estaban.
#   7. Registra la app web y ESCRIBE las siete variables NEXT_PUBLIC_FIREBASE_*
#      en un archivo, en vez de que las copies de la consola a mano.
#   8. Genera la clave de servicio y la deja también en base64.
#   9. Despliega las reglas de Firestore y Storage, las MISMAS que producción.
#  10. Pone el CORS del bucket y siembra los planes.
#
# Queda a mano, si lo usas, el proveedor de Google de Authentication: necesita
# su propio cliente OAuth y eso no se puede clonar. Te lo recuerda al terminar.
#
# CÓMO SE USA
# -----------
#   gcloud auth login
#   npx firebase login
#   gcloud firestore databases describe --project backup-reader --format="value(locationId)"
#   .\herramientas\crear-staging.ps1 -Region LA-REGION
#
# La REGIÓN tiene que ser LA MISMA que la de producción, y no se puede cambiar
# después. Por eso es obligatoria y va escrita a mano: heredarla por descuido
# no tendría arreglo.
#
# NO TOCA PRODUCCIÓN: el id está fijo aquí abajo y se comprueba.
#
# El archivo va con marca de UTF-8 (BOM) a propósito: sin ella, PowerShell 5.1
# lo lee como ANSI y los acentos salen rotos («RegiÃ³n»). No cambia lo que
# hace, pero un guion que escribe mal lo que te está preguntando da la
# impresión de estar fallando cuando no falla.

param(
  [Parameter(Mandatory = $true)][string]$Region,
  [string]$Facturacion
)

$ErrorActionPreference = "Stop"

# Se coloca solo en la carpeta de la aplicación, así da igual desde dónde se
# llame: dentro busca `cors.json`, `firebase.json` y la herramienta de siembra
# por ruta relativa, y correrlo desde la raíz del repositorio fallaba con
# errores que no decían nada de la causa.
Set-Location (Join-Path $PSScriptRoot "..")

$Proyecto = "backup-reader-staging"
$Dominio  = "staging.backupreader.com"
$Bucket   = "$Proyecto.firebasestorage.app"
# La región de Firestore y la del bucket NO son el mismo catálogo. Firestore
# usa multirregiones propias («nam5», «eur3») que Storage no acepta, así que
# pasarle «nam5» al bucket falla con un error que no explica por qué. Se
# traduce a la región de Storage que les corresponde.
$RegionBucket = switch ($Region) {
  "nam5"  { "us-central1" }
  "nam7"  { "us-central1" }
  "eur3"  { "europe-west1" }
  default { $Region }
}
$Salida   = "staging.env"
$Clave    = "staging-service-account.json"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Aviso($texto) { Write-Host $texto -ForegroundColor Yellow }

if ($Proyecto -eq "backup-reader") {
  Write-Host "Ese es el proyecto de producción. Esto no se corre contra producción." -ForegroundColor Red
  exit 1
}

foreach ($cmd in @("gcloud", "npx")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Falta $cmd en el PATH." -ForegroundColor Red
    exit 1
  }
}

Write-Host "Proyecto: $Proyecto"
Write-Host "Región:   $Region (bucket: $RegionBucket)"
Write-Host "Dominio:  $Dominio"
$ok = Read-Host "¿Seguimos? [s/N]"
if ($ok -ne "s" -and $ok -ne "S") { exit 0 }

Paso "1/10 Facturación"
# Sin facturación no sigue adelante: Storage la exige y la API de
# Authentication también, así que seguir solo produce un 400 y un 403 sueltos
# que no dicen que la causa es ésta.
if (-not $Facturacion) {
  # La de producción es la que se quiere: así staging va a la misma cuenta y
  # no hay que buscar el identificador a mano.
  $Facturacion = (gcloud billing projects describe backup-reader `
    --format="value(billingAccountName)" 2>$null) -replace "billingAccounts/", ""
}
if (-not $Facturacion) {
  $Facturacion = (gcloud billing accounts list --format="value(name)" 2>$null |
    Select-Object -First 1) -replace "billingAccounts/", ""
}
if ($Facturacion) {
  Write-Host "Cuenta: $Facturacion"
  gcloud billing projects link $Proyecto --billing-account=$Facturacion | Out-Null
  if ($LASTEXITCODE -ne 0) { Aviso "No se pudo vincular esa cuenta." }
}

$activa = gcloud billing projects describe $Proyecto --format="value(billingEnabled)" 2>$null
if ("$activa" -ne "True") {
  Write-Host @"

PARADO. El proyecto sigue sin facturación, y sin ella Storage no se puede
crear y la API de Authentication responde 403.

Mira cuál usa producción:
  gcloud billing projects describe backup-reader --format="value(billingAccountName)"

Y vuelve a correr esto con ese identificador:
  .\herramientas\crear-staging.ps1 -Region $Region -Facturacion XXXXXX-XXXXXX-XXXXXX

Si no te deja por permisos, pásalo a Blaze desde la consola de Firebase
(abajo a la izquierda, Actualizar) y repite. Lo ya creado no se toca.
"@ -ForegroundColor Red
  exit 1
}
Write-Host "Facturación activa."

Paso "2/10 APIs"
gcloud services enable firestore.googleapis.com firebasestorage.googleapis.com `
  identitytoolkit.googleapis.com firebase.googleapis.com --project $Proyecto

Paso "3/10 Firestore"
# $LASTEXITCODE y no try/catch: en Windows PowerShell 5.1 un programa externo
# que falla no lanza excepción, así que el catch nunca se ejecutaría.
gcloud firestore databases describe --project $Proyecto 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Ya existe, no se toca."
} else {
  gcloud firestore databases create --location=$Region --project $Proyecto
}

$token = gcloud auth print-access-token
$cabeceras = @{ Authorization = "Bearer $token" }

Paso "4/10 Storage"
# El bucket por defecto de Firebase se pide a su propia API. Si falla, son dos
# clics en la consola (Storage → Comenzar) y el resto del guion sigue valiendo.
try {
  Invoke-RestMethod -Method Post -Headers $cabeceras -ContentType "application/json" `
    -Uri "https://firebasestorage.googleapis.com/v1beta/projects/$Proyecto/defaultBucket?bucketId=$Bucket" `
    -Body (@{ storageClass = "STANDARD"; location = $RegionBucket } | ConvertTo-Json) | Out-Null
  Write-Host "Bucket: gs://$Bucket"
} catch {
  Aviso "No se pudo crear el bucket ($($_.Exception.Message)). Créalo en la consola y sigue."
}

Paso "5/10 Correo y contraseña"
# Hay que inicializar Authentication antes de tocar su configuración, o la API
# responde 403 sin más explicación. Es lo mismo que el botón «Comenzar» de la
# consola, y si ya estaba hecho, da error y se ignora.
try {
  Invoke-RestMethod -Method Post -Headers $cabeceras -ContentType "application/json" `
    -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$Proyecto/identityPlatform:initializeAuth" `
    -Body "{}" | Out-Null
  Write-Host "Authentication inicializado."
} catch {
  Write-Host "Authentication ya estaba inicializado."
}
$cuerpo = @{ signIn = @{ email = @{ enabled = $true; passwordRequired = $true } } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Patch -Headers $cabeceras -ContentType "application/json" `
  -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$Proyecto/config?updateMask=signIn.email" `
  -Body $cuerpo | Out-Null
Write-Host "Activado."

Paso "6/10 Dominio autorizado"
# Se leen los que ya hay y se añade el nuevo: mandar solo el nuestro BORRARÍA
# localhost y el dominio de Firebase, y entonces no se podría ni entrar.
$config = Invoke-RestMethod -Headers $cabeceras `
  -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$Proyecto/config"
$dominios = @($config.authorizedDomains)
if ($dominios -notcontains $Dominio) { $dominios += $Dominio }
$cuerpo = @{ authorizedDomains = $dominios } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Headers $cabeceras -ContentType "application/json" `
  -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$Proyecto/config?updateMask=authorizedDomains" `
  -Body $cuerpo | Out-Null
Write-Host ("Autorizados: " + ($dominios -join ", "))

Paso "7/10 App web y variables"
try { npx firebase apps:create WEB staging -P $Proyecto | Out-Null }
catch { Write-Host "La app ya existía." }
npx firebase apps:sdkconfig WEB -P $Proyecto --json | Out-File -Encoding utf8 sdkconfig.json
$cfg = (Get-Content sdkconfig.json -Raw | ConvertFrom-Json).result.sdkConfig
@(
  "NEXT_PUBLIC_FIREBASE_API_KEY=$($cfg.apiKey)",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$($cfg.authDomain)",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$($cfg.projectId)",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$($cfg.storageBucket)",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$($cfg.messagingSenderId)",
  "NEXT_PUBLIC_FIREBASE_APP_ID=$($cfg.appId)",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$($cfg.measurementId)"
) | Set-Content -Encoding utf8 $Salida
Remove-Item sdkconfig.json -ErrorAction SilentlyContinue
Write-Host "Escritas 7 variables en $Salida"

Paso "8/10 Clave de servicio"
$sa = gcloud iam service-accounts list --project $Proyecto `
  --filter="email~firebase-adminsdk" --format="value(email)" | Select-Object -First 1
if ($sa -and -not (Test-Path $Clave)) {
  gcloud iam service-accounts keys create $Clave --iam-account $sa --project $Proyecto
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $Clave)))
  Add-Content -Encoding utf8 $Salida @(
    "FIREBASE_PROJECT_ID=$Proyecto",
    "FIREBASE_CLIENT_EMAIL=$sa",
    "FIREBASE_SERVICE_ACCOUNT_B64=$b64"
  )
  Write-Host "Clave en $Clave y su base64 añadido a $Salida"
} else {
  Write-Host "Ya hay clave, o no se encontró la cuenta de servicio."
}

Paso "9/10 Reglas, las mismas que producción"
npx firebase deploy --only firestore:rules,storage:rules -P $Proyecto

Paso "10/10 CORS y planes"
# `gcloud storage` en vez de `gsutil`: gsutil arrastra su propio Python y en
# Windows es donde más falla.
try { gcloud storage buckets update "gs://$Bucket" --cors-file=cors.json }
catch { Aviso "CORS: comprueba el nombre del bucket y repítelo a mano." }

$env:BR_PROYECTO = $Proyecto
$env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path $Clave)
try { node herramientas/sembrar-emulador.mjs planes }
catch { Aviso "Siembra: revisa la clave y repítelo a mano." }

Write-Host @"

LISTO.

  $Salida   <- las variables para pegar en Vercel (alcance Preview)
  $Clave    <- la clave de servicio. NO la subas al repositorio.

Los dos están ignorados por git, pero compruébalo antes de confirmar nada.

Falta a mano, si lo usas: el proveedor de Google en Authentication, que
necesita su propio cliente OAuth y no se puede clonar.
"@ -ForegroundColor Green
