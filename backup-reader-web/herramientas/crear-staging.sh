#!/usr/bin/env bash
#
# Deja listo el proyecto de pruebas (staging) sin ir clic a clic por la consola.
#
# QUÉ HACE, Y QUÉ NO
# ------------------
# Firebase no tiene «duplicar proyecto», pero casi todo lo que hay que
# configurar se puede pedir por línea de comandos. Esto hace, en orden:
#
#   1. Vincula la cuenta de facturación (Storage la exige).
#   2. Enciende las APIs que hacen falta.
#   3. Crea Firestore en la región que le digas.
#   4. Crea el bucket de Storage.
#   5. Activa el inicio de sesión con correo y contraseña.
#   6. Autoriza el dominio de staging para que se pueda iniciar sesión.
#   7. Registra la app web y ESCRIBE las siete variables NEXT_PUBLIC_FIREBASE_*
#      en un archivo, en vez de que las copies de la consola a mano.
#   8. Genera la clave de servicio y la deja también en base64.
#   9. Despliega las reglas de Firestore y Storage, las MISMAS que producción.
#  10. Pone el CORS del bucket y siembra los planes.
#
# Lo único que puede quedarte a mano es el proveedor de Google de
# Authentication, si lo usas: necesita su propio cliente OAuth y eso no se
# puede clonar. El guion te lo recuerda al terminar.
#
# CÓMO SE USA
# -----------
#   ./herramientas/crear-staging.sh REGION [CUENTA_DE_FACTURACION]
#
# La REGIÓN tiene que ser LA MISMA que la de producción, y no se puede cambiar
# después. Para verla:
#
#   gcloud firestore databases describe --project backup-reader --format='value(locationId)'
#
# La cuenta de facturación, si no la pasas, se intenta adivinar de la primera
# que tengas abierta:
#
#   gcloud billing accounts list
#
# ANTES DE CORRER ESTO
# --------------------
#   gcloud auth login
#   npx firebase login
#
# NO TOCA PRODUCCIÓN. El id está fijo aquí abajo y se comprueba.

set -euo pipefail

PROYECTO="backup-reader-staging"
DOMINIO="staging.backupreader.com"
SALIDA="staging.env"
CLAVE="staging-service-account.json"

REGION="${1:-}"
FACTURACION="${2:-}"

rojo() { printf '\033[31m%s\033[0m\n' "$*"; }
paso() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

if [ -z "$REGION" ]; then
  rojo "Falta la región. Mira la de producción con:"
  echo "  gcloud firestore databases describe --project backup-reader --format='value(locationId)'"
  exit 1
fi

# Un despiste aquí sería escribir en producción, así que se comprueba a mano.
case "$PROYECTO" in
  backup-reader|backup-reader-prod)
    rojo "Ese es el proyecto de producción. Esto no se corre contra producción."
    exit 1
    ;;
esac

# En Windows esto no corre: usa herramientas/crear-staging.ps1, que hace lo
# mismo sin depender de python3, base64 ni gsutil.
for cmd in gcloud npx; do
  command -v "$cmd" >/dev/null || { rojo "Falta $cmd."; exit 1; }
done

echo "Proyecto: $PROYECTO"
echo "Región:   $REGION"
echo "Dominio:  $DOMINIO"
read -r -p "¿Seguimos? [s/N] " ok
[ "$ok" = "s" ] || [ "$ok" = "S" ] || exit 0

paso "1/10 Facturación"
if [ -z "$FACTURACION" ]; then
  FACTURACION="$(gcloud billing accounts list --filter=open=true --format='value(name)' | head -1 | sed 's#billingAccounts/##')"
fi
if [ -n "$FACTURACION" ]; then
  gcloud billing projects link "$PROYECTO" --billing-account="$FACTURACION" || \
    rojo "No se pudo vincular la facturación; hazlo en la consola y vuelve a correr esto."
else
  rojo "No encontré ninguna cuenta de facturación. Pásala como segundo argumento."
fi

paso "2/10 APIs"
gcloud services enable \
  firestore.googleapis.com \
  firebasestorage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebase.googleapis.com \
  --project "$PROYECTO"

paso "3/10 Firestore"
if gcloud firestore databases describe --project "$PROYECTO" >/dev/null 2>&1; then
  echo "Ya existe, no se toca."
else
  gcloud firestore databases create --location="$REGION" --project "$PROYECTO"
fi

paso "4/10 Storage"
# El bucket por defecto de Firebase se pide a su propia API; si cambia o falla,
# se crean dos clics en la consola y el resto del guion sigue valiendo.
TOKEN="$(gcloud auth print-access-token)"
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firebasestorage.googleapis.com/v1beta/projects/$PROYECTO/defaultBucket?bucketId=$PROYECTO.firebasestorage.app" \
  -d '{"storageClass":"STANDARD","location":"'"$REGION"'"}' | head -c 400 || \
  rojo "No se pudo crear el bucket; créalo en la consola (Storage → Comenzar) y sigue."
echo

paso "5/10 Correo y contraseña"
curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROYECTO/config?updateMask=signIn.email" \
  -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' | head -c 200
echo

paso "6/10 Dominio autorizado"
ACTUALES="$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROYECTO/config" \
  | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin).get("authorizedDomains",[])))')"
LISTA="$(python3 - "$ACTUALES" "$DOMINIO" <<'PY'
import json, sys
actuales = [d for d in sys.argv[1].split(",") if d]
if sys.argv[2] not in actuales:
    actuales.append(sys.argv[2])
print(json.dumps({"authorizedDomains": actuales}))
PY
)"
curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROYECTO/config?updateMask=authorizedDomains" \
  -d "$LISTA" | head -c 200
echo

paso "7/10 App web y variables"
npx firebase apps:create WEB staging -P "$PROYECTO" >/dev/null 2>&1 || echo "La app ya existía."
npx firebase apps:sdkconfig WEB -P "$PROYECTO" --json > /tmp/sdkconfig.json
python3 - "$SALIDA" <<'PY'
import json, sys
cfg = json.load(open("/tmp/sdkconfig.json"))["result"]["sdkConfig"]
pares = [
    ("NEXT_PUBLIC_FIREBASE_API_KEY", cfg.get("apiKey", "")),
    ("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", cfg.get("authDomain", "")),
    ("NEXT_PUBLIC_FIREBASE_PROJECT_ID", cfg.get("projectId", "")),
    ("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", cfg.get("storageBucket", "")),
    ("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", cfg.get("messagingSenderId", "")),
    ("NEXT_PUBLIC_FIREBASE_APP_ID", cfg.get("appId", "")),
    ("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", cfg.get("measurementId", "")),
]
with open(sys.argv[1], "w") as f:
    for k, v in pares:
        f.write(f"{k}={v}\n")
print("Escritas 7 variables en " + sys.argv[1])
PY

paso "8/10 Clave de servicio"
SA="$(gcloud iam service-accounts list --project "$PROYECTO" \
  --filter='email~firebase-adminsdk' --format='value(email)' | head -1)"
if [ -n "$SA" ] && [ ! -f "$CLAVE" ]; then
  gcloud iam service-accounts keys create "$CLAVE" --iam-account "$SA" --project "$PROYECTO"
  {
    echo "FIREBASE_PROJECT_ID=$PROYECTO"
    echo "FIREBASE_CLIENT_EMAIL=$SA"
    printf 'FIREBASE_SERVICE_ACCOUNT_B64=%s\n' "$(base64 "$CLAVE" | tr -d '\n')"
  } >> "$SALIDA"
  echo "Clave en $CLAVE y su base64 añadido a $SALIDA"
else
  echo "Ya hay clave, o no se encontró la cuenta de servicio."
fi

paso "9/10 Reglas, las mismas que producción"
npx firebase deploy --only firestore:rules,storage:rules -P "$PROYECTO"

paso "10/10 CORS y planes"
# `gcloud storage` en vez de `gsutil`: gsutil arrastra su propio Python y da
# más problemas de los que resuelve.
gcloud storage buckets update "gs://$PROYECTO.firebasestorage.app" --cors-file=cors.json || \
  rojo "CORS: comprueba el nombre del bucket y repítelo a mano."
BR_PROYECTO="$PROYECTO" GOOGLE_APPLICATION_CREDENTIALS="$PWD/$CLAVE" \
  node herramientas/sembrar-emulador.mjs planes || \
  rojo "Siembra: revisa la clave y repítelo a mano."

cat <<FIN

LISTO.

  $SALIDA   <- las variables para pegar en Vercel (alcance Preview)
  $CLAVE    <- la clave de servicio. NO la subas al repositorio.

Los dos archivos están ignorados por git, pero compruébalo antes de confirmar.

Falta a mano, si lo usas: el proveedor de Google en Authentication, que
necesita su propio cliente OAuth y no se puede clonar.
FIN
