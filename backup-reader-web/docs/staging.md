# Entorno de pruebas (staging)

Staging es la misma aplicación contra **otro Firebase y otro dominio**, para
poder probar con subidas, pagos y correos de verdad sin tocar nada de lo que
usa la gente.

Regla de oro: **de producción no se copia nada a staging.** Los backups están
cifrados de extremo a extremo, así que sin la contraseña del usuario no se
abrirían de todas formas, y son datos de personas. Staging se llena con datos
inventados.

---

## Lo que ya está en el repositorio

- `.firebaserc` tiene el alias `staging`, así que las reglas se despliegan con
  `-P staging` sin escribir el nombre del proyecto cada vez.
- `lib/entorno.ts`. Fuera de producción, la aplicación **no se indexa** en
  buscadores y **no carga las etiquetas de medición**, para que las pruebas no
  se cuenten como visitas reales. Lo decide `NEXT_PUBLIC_VERCEL_ENV`, que
  **Vercel pone sola** en cada despliegue, así que no hay que configurarlo;
  `NEXT_PUBLIC_ENTORNO` queda como salida de emergencia para forzarlo a mano.
  Sin ninguna de las dos se comporta como producción, así que el sitio de
  verdad no cambia.
- `herramientas/sembrar-emulador.mjs` puede sembrar un Firebase real con
  `BR_PROYECTO`, y se niega a hacerlo contra producción.

## El atajo: un guion que lo deja casi todo hecho

Casi nada de lo de abajo hace falta clic a clic. Con el proyecto ya creado en
la consola (eso sí es a mano), y tras `gcloud auth login` y `npx firebase
login`:

```sh
# la región TIENE que ser la misma que producción, y no se puede cambiar
gcloud firestore databases describe --project backup-reader --format='value(locationId)'

./herramientas/crear-staging.sh LA-REGION
```

Vincula la facturación, enciende las APIs, crea Firestore y Storage, activa el
inicio de sesión con correo, autoriza el dominio, registra la app web y
**escribe las siete variables `NEXT_PUBLIC_FIREBASE_*` en `staging.env`** en vez
de que las copies de la consola, genera la clave de servicio con su base64,
despliega las reglas, pone el CORS y siembra los planes.

Deja dos archivos, los dos ignorados por git: `staging.env` y
`staging-service-account.json`. El repositorio es público, así que compruébalo
igualmente antes de confirmar nada.

Solo queda a mano el proveedor de Google en Authentication, si se usa: necesita
su propio cliente OAuth y eso no se puede clonar.

## Lo mismo, a mano, paso a paso

### 1. El proyecto de Firebase

1. En la consola de Firebase, **Añadir proyecto** con el id
   `backup-reader-staging`. Desactiva Google Analytics: aquí no se mide nada.
2. **Authentication → Empezar**, y activa los mismos proveedores que en
   producción (correo y contraseña, y Google si está activo allí).
3. **Firestore → Crear base de datos**, en la misma región que producción.
4. **Storage → Empezar**, y apunta el nombre del bucket que te dé.
5. **Configuración del proyecto → Tus apps → Web**, registra una app y guarda
   el bloque de configuración: de ahí salen las siete variables
   `NEXT_PUBLIC_FIREBASE_*`.
6. **Configuración del proyecto → Cuentas de servicio → Generar clave
   privada**. Ese JSON es el de `FIREBASE_SERVICE_ACCOUNT_B64`. No se guarda en
   el repositorio, que es público.
7. Plan **Blaze**, si vas a probar subidas grandes. El gasto de staging es casi
   cero, pero Storage lo pide.

### Lo que se copia solo, y lo que no

Firebase no tiene «duplicar proyecto». De la configuración de producción:

- **Las reglas de Firestore y Storage se copian con un comando**, porque salen
  del mismo archivo del repositorio. Es lo más delicado y lo más barato.
- **Los planes** los pone la herramienta de siembra.
- **El CORS del bucket** sale de `cors.json`.
- **A mano quedan cuatro cosas**, y por un motivo: crear Firestore y Storage
  (hay que elegir región y eso no se puede cambiar después), activar los
  proveedores de Authentication (el de Google necesita su propio cliente
  OAuth), pasar a Blaze, y autorizar el dominio.

### Los índices de Firestore

No están versionados. Si producción tiene índices compuestos, se sacan de allí
y se llevan a staging:

```sh
npx firebase firestore:indexes -P default > firestore.indexes.json
```

y luego se añade a `firebase.json`, dentro de `"firestore"`, la línea
`"indexes": "firestore.indexes.json"`.

**Cuidado con el orden.** Ese archivo no se crea vacío ni a medias: un
`deploy --only firestore:indexes` contra producción con un archivo incompleto
BORRA los índices que no estén en él. Primero se exporta de producción, se
revisa que estén todos, y solo entonces se despliega a staging.

### Después, desde el repositorio

```sh
npx firebase deploy --only firestore:rules,storage:rules -P staging
gsutil cors set cors.json gs://EL-BUCKET-DE-STAGING
```

Y para que la pantalla de planes no salga vacía:

```sh
BR_PROYECTO=backup-reader-staging \
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/la/clave.json \
node herramientas/sembrar-emulador.mjs planes
```

### 2. El dominio y el despliegue

2. En Vercel, **Settings → Git**, deja `main` como rama de producción. La rama
   que se prueba es `staging-ig`, que ya está subida.
3. **Settings → Domains**, añade `staging.backupreader.com` y asígnalo a la
   rama `staging-ig`. Esto es lo que te deja abrirlo **desde el móvil**
   con tu export real.
4. **Settings → Deployment Protection**, enciende la protección por contraseña
   para las previews. Doble red con el `noindex`.
5. **Settings → Environment Variables**, con alcance *Preview*, pon las
   variables de abajo. Ojo: las de producción **no se tocan**.

### 3. Las variables de staging

Cambian respecto a producción:

| Variable | Valor en staging |
|---|---|
| `NEXT_PUBLIC_INSTAGRAM_ENABLED` | `1`, para poder probar Instagram |
| `NEXT_PUBLIC_FIREBASE_*` | las siete del proyecto nuevo |
| `NEXT_PUBLIC_URL_BASE` | `https://staging.backupreader.com` |
| `FIREBASE_SERVICE_ACCOUNT_B64` | la clave del proyecto nuevo, en base64 |
| `NEXT_PUBLIC_STRIPE_KEYP` | la `pk_test_…` |
| `STRIPE_SECRET_KEY` | la `sk_test_…` |
| `NEXT_PUBLIC_OPTWARD_SITE_ID` | vacío, para no medir |

Las banderas de lo que se está probando van encendidas aquí y apagadas en
producción: hoy son `NEXT_PUBLIC_ANALISIS_ENABLED=1` y
`NEXT_PUBLIC_INSTAGRAM_ENABLED=1`.

`NEXT_PUBLIC_ENTORNO` no hace falta ponerla: en una preview de Vercel, la
propia Vercel ya marca el despliegue y la aplicación se da cuenta sola.

### 4. Lo que queda por conectar según lo vayas necesitando

- **Auth**: añade `staging.backupreader.com` en *Authentication → Settings →
  Dominios autorizados*, o no se podrá iniciar sesión.
- **Google Drive**: el `NEXT_PUBLIC_GOOGLE_CLIENT_ID` tiene que tener el
  subdominio entre sus orígenes autorizados en Google Cloud.
- **Stripe**: un webhook aparte en modo prueba, apuntando al subdominio.
- **Correo**: Resend manda de verdad. Usa una dirección tuya.

---

## Cómo se usa después

- Día a día, emuladores: `npx firebase emulators:start --only firestore,storage,auth --project demo-backupreader`.
- Para probar algo que los emuladores no cubren (el móvil, el dominio, pagos,
  correos, subidas grandes), empuja a `staging-ig` y pruébalo en el
  subdominio.
- A producción se pasa fusionando a `main`, y las banderas se encienden
  después, por separado.
