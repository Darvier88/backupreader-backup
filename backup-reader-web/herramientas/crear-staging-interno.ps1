# Monta un entorno de pruebas DENTRO del proyecto de producción.
#
# POR QUÉ ASÍ Y NO CON OTRO PROYECTO
# ----------------------------------
# Un proyecto nuevo de Firebase necesita Blaze para usar Storage, y vincular
# una cuenta de facturación necesita un permiso que no siempre se tiene. Pero
# un proyecto puede tener VARIAS bases de Firestore y VARIOS buckets, y
# `backup-reader` ya está en Blaze. Así que las pruebas pueden vivir ahí, en su
# propia base y su propio bucket, sin pedirle permiso a nadie.
#
# QUÉ QUEDA SEPARADO Y QUÉ NO
# ---------------------------
# Separado de verdad: los chats, los backups, los planes, el estado de usuario.
# Nada de lo que se escriba probando toca los datos de producción.
#
# NO separado: el registro de usuarios. Authentication es del proyecto, así que
# las cuentas de prueba aparecen en la misma lista que las reales. Es el precio
# de no crear otro proyecto, y conviene saberlo antes que descubrirlo: usa un
# correo que se distinga, y bórralo cuando acabes.
#
# Tampoco separa la factura ni las cuotas, pero el gasto de unas pruebas es
# despreciable al lado del tráfico normal.
#
# CÓMO SE USA
# -----------
#   gcloud auth login
#   npx firebase login
#   .\herramientas\crear-staging-interno.ps1
#
# Se puede repetir: lo que ya existe se detecta y no se toca.

param(
  [string]$Proyecto = "backup-reader",
  [string]$Base     = "staging",
  [string]$Bucket   = "backup-reader-staging-data",
  [string]$Region   = "nam5",
  [string]$RegionBucket = "us-central1"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Aviso($t) { Write-Host $t -ForegroundColor Yellow }

Write-Host @"
Esto crea, DENTRO de ${Proyecto}:

  - una base de Firestore llamada «$Base» ($Region)
  - un bucket de Storage «$Bucket» ($RegionBucket)

No toca la base por defecto ni el bucket de producción. Lo que SÍ se comparte
es el registro de usuarios: las cuentas de prueba saldrán en la misma lista.
"@

$ok = Read-Host "¿Seguimos? [s/N]"
if ($ok -ne "s" -and $ok -ne "S") { exit 0 }

Paso "1/5 Base de datos"
# Se mira $LASTEXITCODE y no try/catch: un programa externo que falla NO lanza
# excepción en Windows PowerShell 5.1, así que el catch no se ejecutaría nunca
# y el guion daría por existente una base que no existe, para luego fallar más
# adelante sin relación aparente.
gcloud firestore databases describe --database=$Base --project $Proyecto 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Ya existe, no se toca."
} else {
  gcloud firestore databases create --database=$Base --location=$Region --project $Proyecto
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo crear la base." -ForegroundColor Red; exit 1 }
}

Paso "2/5 Bucket"
gcloud storage buckets describe "gs://$Bucket" --project $Proyecto 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Ya existe, no se toca."
} else {
  # Acceso uniforme: las reglas de Firebase son la única autorización, sin
  # permisos por objeto que puedan contradecirlas.
  gcloud storage buckets create "gs://$Bucket" --location=$RegionBucket `
    --project $Proyecto --uniform-bucket-level-access
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo crear el bucket." -ForegroundColor Red; exit 1 }
}

Paso "3/5 Dar de alta el bucket en Firebase"
# Un bucket de Cloud Storage no obedece las reglas de Firebase hasta que se da
# de alta. Sin esto, la aplicación recibiría 403 al subir y parecería un
# problema de permisos del usuario.
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

Paso "4/5 Reglas y CORS"
# Se despliega con un `firebase.json` aparte, que apunta SOLO a la base y al
# bucket de pruebas. Usar el de siempre desplegaría también sobre producción:
# serían las mismas reglas y no cambiaría nada, pero es un cambio en producción
# que nadie pidió.
npx firebase deploy --only firestore:rules,storage:rules `
  --config firebase.staging-interno.json -P $Proyecto

gcloud storage buckets update "gs://$Bucket" --cors-file=cors.json --project $Proyecto

Paso "5/5 Planes"
$clave = "staging-service-account.json"
if (-not (Test-Path $clave)) {
  $sa = gcloud iam service-accounts list --project $Proyecto `
    --filter="email~firebase-adminsdk" --format="value(email)" | Select-Object -First 1
  if ($sa) {
    gcloud iam service-accounts keys create $clave --iam-account $sa --project $Proyecto
  }
}
if (Test-Path $clave) {
  $env:BR_PROYECTO = $Proyecto
  $env:BR_BASE = $Base
  $env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path $clave)
  node herramientas/sembrar-emulador.mjs planes
} else {
  Aviso "Sin clave de servicio: siembra los planes a mano cuando la tengas."
}

$lineas = @(
  "NEXT_PUBLIC_FIRESTORE_DB=$Base",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$Bucket",
  "NEXT_PUBLIC_INSTAGRAM_ENABLED=1",
  "NEXT_PUBLIC_ANALISIS_ENABLED=1"
)
$lineas | Set-Content -Encoding utf8 "staging.env"

Write-Host @"

LISTO.

En staging.env tienes las líneas que cambian. Para probar en local, ponlas en
tu .env.local ENCIMA de las de siempre y quita NEXT_PUBLIC_USE_EMULATORS:

$($lineas -join "`n")

El resto de variables de Firebase se quedan como están, porque es el mismo
proyecto. Para volver a producción, borra esas dos primeras líneas.

Recuerda: el registro de usuarios es compartido. Usa un correo que se
distinga y bórralo al acabar.
"@ -ForegroundColor Green
