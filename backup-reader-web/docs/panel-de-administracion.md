# Panel de administración

Borra una cuenta y todo lo suyo: chats, bóveda, perfil y cliente de Stripe.
Vive en `/admin` y no hay ningún enlace que lleve ahí.

---

## Lo que hay que configurar antes

Sin esto, el panel carga y dice que falta la cuenta de servicio. **No se
puede probar en producción sin configurarlo primero.**

### 1. La cuenta de servicio de Firebase

Es la parte nueva. El resto del backend verifica los tokens con la API REST de
Identity Toolkit, que solo necesita la API key pública. Para administrar eso no
alcanza: con un ID token se puede borrar la **propia** cuenta, no la de otro, y
tampoco se pueden enumerar los usuarios.

1. Consola de Firebase → ⚙️ Configuración del proyecto → **Cuentas de
   servicio** → *Generar nueva clave privada*. Baja un `.json`.
2. Conviértelo a base64 en una línea:

   ```bash
   base64 -w0 backup-reader-xxxxx.json      # Linux
   base64 -i backup-reader-xxxxx.json       # macOS
   ```

3. En Vercel → Settings → Environment Variables, crea:

   | Variable | Valor |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT_B64` | el churro de base64 |

   Marca **Production** y **Preview**. Es secreta: **sin** el prefijo
   `NEXT_PUBLIC_`, o entraría en el bundle del navegador y cualquiera podría
   descargarla y hacerse dueño del proyecto entero.

El base64 es el formato recomendado porque es una sola línea. Si prefieres el
JSON en crudo va en `FIREBASE_SERVICE_ACCOUNT`, y también se admite el trío
`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. En
ese último caso ojo con los saltos de línea de la clave privada: Vercel guarda
el valor literal y el SDK falla con *Invalid PEM formatted message*. El código
convierte los `\n` escapados, pero el base64 evita el problema de raíz.

**Guarda el `.json` donde no se pierda y no lo subas al repositorio.** Da
acceso total al proyecto de Firebase. Si se filtra, se revoca desde la misma
pantalla de la consola.

### 2. Quién es admin

| Variable | Valor |
|---|---|
| `SUPER_ADMIN_UIDS` | tu uid de Firebase |

Tu uid sale de Firebase → Authentication → la columna *Identificador de
usuario*. Se admiten varios separados por coma.

También existe `SUPER_ADMIN_EMAILS`, más cómodo de escribir, pero el uid es
preferible: un correo se puede cambiar o reasignar y el uid no cambia nunca.

El permiso **no** sale de Firestore a propósito. Hoy las reglas dejan que un
usuario escriba su propio documento `users/{uid}` completo, así que un campo
`esAdmin` ahí sería autoasignable desde la consola del navegador. Una variable
de entorno solo se cambia desde Vercel.

Si no pones ninguna de las dos, **nadie** es admin y el panel no deja hacer
nada. El caso vacío cierra, no abre.

### 3. Stripe

Ya debería estar: `STRIPE_SECRET_KEY`. Si falta, el borrado avisa de que la
suscripción **no** se canceló en vez de dar el paso por bueno.

### 4. Tiempo de la función (recomendado)

Una cuenta con muchos chats puede tener miles de objetos en Storage. El
borrado está hecho para poder repetirse, así que no se pierde nada si se
corta, pero da menos vueltas con más tiempo. Crea un `vercel.json` en la raíz:

```json
{
  "functions": {
    "backup-reader-web/pages/api/admin/*.ts": { "maxDuration": 60 }
  }
}
```

### 5. Las reglas de Firestore

`firestore.rules` cambió: ahora declara `adminAudit` cerrada a todo el mundo
desde el navegador. Despliégalas:

```bash
firebase deploy --only firestore:rules
```

No es urgente —el cierre por defecto ya la cubría— pero deja escrito que es
deliberado.

---

## Cómo se usa

1. Entra a `/admin` con tu cuenta.
2. La tabla lista todas las cuentas, las más nuevas arriba: correo, alta,
   último acceso, plan, número de chats y espacio ocupado.
3. El botón **Borrar** abre una confirmación que primero consulta Stripe y te
   enseña qué hay en juego: cliente, suscripción viva y cuánto se le cobró.
4. Para que el botón se active hay que **escribir el correo del usuario**. No
   es un sí/no a propósito: con una tabla de correos parecidos, el error fácil
   no es querer borrar, es equivocarse de fila.
5. Si el usuario tiene dinero cobrado, aparece una casilla opcional para
   devolvérselo. Viene apagada: borrar una cuenta y devolver plata son dos
   decisiones distintas.
6. Al terminar se enseña paso por paso qué se borró.

### Qué pasa con los pagos

"Eliminar al usuario junto con sus pagos" no se puede cumplir al pie de la
letra, y conviene saberlo antes de usar el panel:

- **Los cobros no se borran.** Stripe no tiene forma de eliminar un cobro, una
  factura ni un payment intent, ni por API ni desde el panel. Son el registro
  contable de un dinero que se movió de verdad, y hace falta para cuadrar la
  contabilidad y para responder una disputa.
- **La suscripción sí se cancela**, y al instante, no al final del periodo: si
  la cuenta se va, no tiene sentido seguir cobrándola.
- **El cliente sí se borra.** Stripe le cancela las suscripciones y le
  desvincula los métodos de pago. Los cobros quedan colgados de un cliente
  borrado.
- **El dinero se puede devolver**, que es lo más cerca que hay de "borrar un
  pago". Es la casilla opcional.

### El orden, y por qué importa

1. **Stripe primero, siempre.** Lo peor que puede pasar en un borrado a medias
   es que la cuenta desaparezca y la suscripción siga cobrando cada mes a
   alguien que ya no puede entrar a cancelarla.
2. **Storage** — el bulto.
3. **Firestore** — metadatos de los chats, bóveda, estado y perfil. La
   subcolección va antes que el padre: en Firestore borrar un documento no
   borra lo que tiene debajo.
4. **Auth, al final.**

Auth va último a propósito. Mientras la cuenta exista en Auth, el usuario
sigue saliendo en la tabla y el borrado se puede volver a lanzar para terminar
lo que faltó. Si se borrara primero, un fallo a mitad dejaría datos sin dueño
que ya no aparecen en ninguna lista: nadie sabría que están ahí y seguirían
contando como datos personales guardados.

Por eso cada paso tolera que lo suyo ya no esté, y **la operación se puede
repetir tantas veces como haga falta**. Si ves *"Quedan N archivos. La cuenta
NO se ha borrado todavía"*, vuelve a lanzarlo sobre la misma fila.

### Esto no se puede deshacer

Los chats están cifrados con una DEK que solo existe envuelta en
`vaults/{uid}`. En cuanto ese documento se va, los blobs son ruido para
siempre, incluso teniendo el bucket delante. No hay copia de seguridad que
rescate nada, tampoco para ti.

### Quién borró qué

Cada borrado se anota en la colección `adminAudit` de Firestore: quién lo
hizo, a quién, cuándo y con qué resultado. Se consulta desde la consola de
Firebase. Está cerrada a lectura y escritura desde el navegador, también para
el propio admin: un rastro que el interesado pueda editar no sirve de rastro.

### Documentos huérfanos

Si arriba de la tabla aparece *"Hay N documentos en Firestore sin cuenta de
acceso"*, son restos de un borrado que quedó a medias antes de que existiera
este panel, o de una cuenta borrada a mano desde la consola. Hay que limpiarlos
desde la consola de Firebase; el panel no puede, porque ya no hay cuenta de
Auth a la que asociarlos.

---

## Probarlo en local

```bash
# terminal 1
npm run emulators

# terminal 2
NEXT_PUBLIC_USE_EMULATORS=1 SUPER_ADMIN_EMAILS=tu@correo.com npm run dev
```

Con los emuladores no hace falta cuenta de servicio: el Admin SDK se conecta
con solo el projectId. **El projectId tiene que ser el mismo en la aplicación y
en el emulador**, o son dos espacios de nombres distintos y parecerá que el
borrado no hace nada.

### Las pruebas

```bash
npm run test:admin
```

Dos ficheros corren siempre, sin emuladores ni red:

- `tests/admin/guardas.test.ts` — quién es admin y si la confirmación vale.
  Lo que comprueba no es el camino bueno, sino que los malos cierren: que sin
  variable de entorno nadie sea admin, que un correo parecido no pase, que el
  uid no valga como confirmación cuando la cuenta tiene correo.
- `tests/admin/borrado.test.ts` — la contabilidad del borrado con dobles. Que
  un archivo que falló cuente como pendiente y no solo como fallido, que el
  tope reporte el resto, que la subcolección se borre antes que el padre, que
  los lotes no pasen del límite de 500 escrituras de Firestore.

El tercero necesita los emuladores levantados y **se salta solo** si no los
encuentra:

- `tests/admin/borradoEmulador.test.ts` — siembra una cuenta con bóveda, tres
  chats y cuatro blobs, la borra y comprueba que no queda nada en ninguna de
  las tres partes. También siembra un usuario vecino y comprueba que sigue
  intacto, y que borrar dos veces no revienta.

Para que esos dos casos corran:

```bash
npm run emulators                                  # terminal 1
NEXT_PUBLIC_USE_EMULATORS=1 npm run test:admin     # terminal 2
```

El resultado tiene que decir `2 skipped` cuando no hay emuladores y
`25 passed` cuando sí.
