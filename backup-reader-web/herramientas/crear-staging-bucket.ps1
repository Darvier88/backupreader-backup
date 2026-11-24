# Un rincón de pruebas dentro de producción, usando SOLO permisos de editor.
#
# POR QUÉ ESTE Y NO LOS OTROS DOS
# -------------------------------
# `crear-staging.ps1` necesita un proyecto aparte, y un proyecto nuevo exige
# Blaze, que exige permisos de facturación.
# `crear-staging-interno.ps1` necesita crear una base de Firestore dentro de
# producción, y eso exige `datastore.databases.create`, que un editor no tiene.
#
# Este no crea ninguna de las dos cosas:
#
#   - LOS BACKUPS van a un bucket aparte. Crear buckets sí puede un editor.
#   - LOS DOCUMENTOS van bajo una cuenta de prueba. Todo en esta aplicación
#     cuelga del identificador de usuario (`backups/{uid}/...`), así que con
#     otra cuenta son documentos nuevos bajo un identificador nuevo: no tocan
#     ni un dato de ningún usuario real.
#
# QUÉ NO SEPARA, Y HAY QUE SABERLO
# --------------------------------
# Los documentos viven en la MISMA base que producción, así que cuentan en su
# cuota y se ven en su consola. Esto no es un entorno aislado: es producción
# con un rincón propio y limpio. Lo que garantiza es que ninguna escritura cae
# sobre datos que ya existen.
#
# El registro de usuarios también es el de producción, así que la cuenta de
# prueba aparece en esa lista. Usa un correo que se distinga y bórrala al
# acabar, con sus datos.
#
# CÓMO SE USA
# -----------
#   gcloud auth login
#   npx firebase login
#   .\herramientas\crear-staging-bucket.ps1
#
# Se puede repetir: lo que ya existe se detecta y no se toca.

param(
  [string]$Proyecto = "backup-reader",
  [string]$Bucket   = "backup-reader-staging-data",
  [string]$RegionBucket = "us-central1"
)

# Los errores de los programas externos no paran el guion: en Windows `gcloud`
# es a su vez un guion de PowerShell y todo lo que escribe en el canal de
# errores (incluido un «no existe» esperado) se convierte en un error de
# PowerShell. Cada llamada comprueba su código de salida, que es lo único que
# distingue «falló» de «escribió algo».
$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Aviso($t) { Write-Host $t -ForegroundColor Yellow }

Write-Host @"
Esto crea, DENTRO de ${Proyecto}:

  - un bucket de Storage «$Bucket» ($RegionBucket)

y NADA más. Los documentos de prueba irán bajo la cuenta que crees al entrar,
con su propio identificador, así que no tocan datos de nadie.

Lo que se comparte con producción: la base de datos (cuota y consola) y el
registro de usuarios.
"@

$ok = Read-Host "¿Seguimos? [s/N]"
if ($ok -ne "s" -and $ok -ne "S") { exit 0 }

Paso "1/4 Bucket"
gcloud storage buckets describe "gs://$Bucket" --project $Proyecto 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Ya existe, no se toca."
} else {
  # Acceso uniforme: las reglas de Firebase son la única autorización, sin
  # permisos por objeto que puedan contradecirlas.
  gcloud storage buckets create "gs://$Bucket" --location=$RegionBucket `
    --project $Proyecto --uniform-bucket-level-access
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo crear el bucket. Aquí ya no hay rodeo: toca pedir permisos o usar emuladores." -ForegroundColor Red
    exit 1
  }
}

Paso "2/4 Dar de alta el bucket en Firebase"
# Un bucket de Cloud Storage no obedece las reglas de Firebase hasta que se da
# de alta. Sin esto, la aplicación recibiría 403 al subir y parecería un
# problema de la cuenta del usuario.
$token = gcloud auth print-access-token
try {
  Invoke-RestMethod -Method Post -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Uri "https://firebasestorage.googleapis.com/v1beta/projects/$Proyecto/buckets/${Bucket}:addFirebase" `
    -Body "{}" | Out-Null
  Write-Host "Dado de alta."
} catch {
  Aviso "Ya estaba dado de alta, o no se pudo: $($_.Exception.Message)"
}

Paso "3/4 Reglas del bucket"
# Con `firebase.staging-bucket.json`, que apunta SOLO a este bucket. Las reglas
# son el mismo archivo que producción y empiezan por `match /b/{bucket}/o`, así
# que valen igual aquí. El bucket de producción no se toca.
npx firebase deploy --only storage:rules --config firebase.staging-bucket.json -P $Proyecto
if ($LASTEXITCODE -ne 0) {
  Aviso "Las reglas no se desplegaron. SIN ELLAS el bucket queda cerrado y la aplicación no podrá subir nada."
  Aviso "Si es por permisos, aquí se acaban los rodeos: emuladores, o pedir acceso."
}

Paso "4/4 CORS"
gcloud storage buckets update "gs://$Bucket" --cors-file=cors.json --project $Proyecto
if ($LASTEXITCODE -ne 0) {
  Aviso "El CORS no se aplicó. Sin él, el navegador no podrá subir archivos a este bucket."
}

$lineas = @(
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$Bucket",
  "NEXT_PUBLIC_INSTAGRAM_ENABLED=1",
  "NEXT_PUBLIC_ANALISIS_ENABLED=1"
)
$lineas | Set-Content -Encoding utf8 "staging.env"

Write-Host @"

LISTO.

Pon estas líneas en tu .env.local, debajo de las que ya tienes, y quita
NEXT_PUBLIC_USE_EMULATORS si la tienes puesta:

$($lineas -join "`n")

Luego arranca con npm run dev, y al entrar CREA UNA CUENTA NUEVA, con un correo que se
distinga (por ejemplo tucorreo+staging@...). Esa cuenta es la que mantiene tus
pruebas separadas de todo lo demás.

Para volver a producción: quita la línea del bucket.

Al terminar, borra la cuenta de prueba desde Authentication. Sus backups están
en gs://$Bucket, que puedes vaciar entero sin pensar:
  gcloud storage rm -r gs://$Bucket/** --project $Proyecto
"@ -ForegroundColor Green
