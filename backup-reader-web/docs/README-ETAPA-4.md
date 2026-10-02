# Etapa 4 · Bóveda y sesión

## Dónde va cada archivo

```
backup-reader-web/
├─ config/
│  └─ vaultRepo.ts                     ← nuevo
├─ context/
│  ├─ VaultContext.tsx                 ← nuevo
│  ├─ VaultReducer.tsx                 ← nuevo
│  └─ index.ts                         ← editar (una línea)
├─ components/
│  └─ vault/                           ← carpeta nueva
│     ├─ index.ts
│     ├─ VaultBanner.tsx
│     ├─ VaultRegisterModal.tsx
│     ├─ VaultUnlockModal.tsx
│     ├─ RecoveryCodeModal.tsx
│     └─ VaultPasswordSection.tsx
├─ pages/_app.tsx                      ← editar
└─ tests/
   └─ vault/                           ← carpeta nueva
      ├─ vaultReducer.test.ts
      └─ vaultFlow.test.ts
```

## Cambios de conexión

**`context/index.ts`** — añadir al final:

```ts
export * from "./VaultContext";
export * from "./VaultReducer";
```

**`pages/_app.tsx`** — envolver dentro de `AuthProvider`:

```tsx
import { VaultProvider } from "../context/VaultContext";

// ...
            <AuthProvider>
              <VaultProvider>
                <AudioPlayingProvider>{children}</AudioPlayingProvider>
              </VaultProvider>
            </AuthProvider>
```

**`components/screens/DashboardScreen.tsx`** — poner el aviso arriba del todo:

```tsx
import { VaultBanner } from "../vault";

// dentro del render, como primer elemento
<VaultBanner />
```

**`components/screens/AccountScreen.tsx`** — añadir el bloque de cifrado:

```tsx
import { VaultPasswordSection } from "../vault";

// donde encaje con el resto de secciones de la cuenta
<VaultPasswordSection />
```

Y nada más. En particular:

**`AuthContext` no se toca.** `VaultContext` escucha `onAuthStateChanged` por su
cuenta, así que al cerrar sesión borra la DEK sin que nadie se lo pida. Evita
una dependencia circular entre los dos contextos y el orden de los providers
deja de importar.

**`LoadingComponent` tampoco se toca todavía.** En el plan original iba aquí un
bloqueo antes de `getFiles`, pero sería un error meterlo ahora: mientras dure la
convivencia v1/v2, los backups en texto plano se siguen leyendo sin bóveda, y
obligar a desbloquear al entrar dejaría fuera a quien solo quiere abrir un chat
viejo. El bloqueo entra en la Etapa 6, cuando haya datos cifrados que leer.

---

## Pruebas automáticas

```bash
npm run test:vault      # añadir el script (abajo)
```

En `package.json`:

```json
"test:vault": "vitest run tests/vault",
```

`npm test` las recoge solas por estar bajo `tests/`.

**`vaultReducer.test.ts`** (13 pruebas, sin emulador) — la máquina de estados.
La que más vale es la de invariantes: recorre todas las transiciones y comprueba
que **nunca hay una DEK en memoria fuera del estado `unlocked`**. Si alguien
añade una acción nueva y se olvida de limpiar la clave, esa prueba lo caza.

**`vaultFlow.test.ts`** (7 pruebas, con emulador) — el ciclo completo con
criptografía real y las reglas reales. Cubre lo que de verdad da miedo:

- crear bóveda → guardar en Firestore → **sesión nueva** → desbloquear y obtener
  exactamente la misma DEK (si esto falla, los datos se pierden para siempre);
- que el record guardado no contenga la contraseña ni el código, comprobado
  buscándolos en el JSON crudo;
- que cambiar la contraseña **no rompa lo ya cifrado**: se cifra un archivo
  antes del cambio y se descifra después, con la contraseña nueva;
- que regenerar el código invalide el anterior;
- que otro usuario no pueda leer ni sobrescribir la bóveda ajena.

Total tras esta etapa: **69 pruebas**.

---

## Pruebas manuales

Lo que ninguna prueba automática cubre, porque es interfaz y navegador.

**Registro**
1. Entra con una cuenta sin bóveda. El dashboard muestra el aviso azul.
2. "Activar cifrado" → contraseña corta → debe rechazarla.
3. Contraseñas que no coinciden → debe rechazarlas.
4. Contraseña válida → aparece el código de recuperación.
5. El botón "Continuar" está deshabilitado hasta marcar la casilla.
6. "Copiar" y "Descargar" funcionan.
7. Al continuar, el aviso del dashboard desaparece.

**Persistencia y desbloqueo**
8. Recarga la página (F5). El aviso vuelve, ahora naranja: la DEK se perdió, que
   es lo correcto.
9. "Desbloquear" con la contraseña incorrecta → mensaje de error, sigue bloqueada.
10. Con la correcta → el aviso desaparece. Tarda ~1 s: es Argon2id, no un fallo.
11. Recarga otra vez y desbloquea con el **código de recuperación** ("He olvidado
    la contraseña").

**Sesión**
12. Cierra sesión y vuelve a entrar. Debe pedir desbloqueo de nuevo.
13. Entra con **otra cuenta**: debe aparecer como cuenta sin bóveda, no la de antes.

**Cuenta**
14. En Cuenta, cambia la contraseña. Recarga y desbloquea con la nueva.
15. La contraseña vieja ya no debe funcionar.
16. Genera un código nuevo. El anterior debe dejar de servir.
17. "Bloquear ahora" deja la bóveda bloqueada sin recargar.

**Auto-bloqueo**
18. Desbloquea y deja el equipo quieto 20 minutos (o baja `AUTO_LOCK_MS` a 10 s
    para probarlo). Debe bloquearse solo. Muévete antes de que pase: no debe.

**Lo que hay que comprobar en las devtools**
19. Application → Local Storage, Session Storage, IndexedDB y Cookies: **no debe
    aparecer la DEK, ni la contraseña, ni el código** en ningún sitio.
20. Firestore, documento `vaults/{uid}`: solo `version`, `kdf`, `pwSalt`,
    `recSalt`, `wrapPassword`, `wrapRecovery`.

**Móvil** — al menos el registro y un desbloqueo en Chrome Android. Argon2id con
64 MiB es donde más se nota la diferencia de gama; si tarda demasiado, el sitio
para ajustarlo es `KDF` en `constants.ts`, y hay que hacerlo **antes** de que
haya usuarios con bóveda creada.

---

## Decisiones que quedan registradas

**La DEK solo en memoria.** Ni localStorage, ni sessionStorage, ni IndexedDB, ni
cookies. Recargar pierde la clave y hay que desbloquear otra vez. Es el
comportamiento correcto: si la clave sobrevive a la recarga, sobrevive también a
cualquier script que se cuele en la página.

**Cambiar contraseña pide la actual**, aunque la bóveda esté abierta. Con la DEK
ya en memoria bastaría técnicamente, pero exigirla evita que quien encuentre el
equipo desatendido se apropie de la cuenta.

**El aviso no bloquea.** Por la convivencia v1/v2 explicada arriba.

**Auto-bloqueo a los 20 minutos** de inactividad, contando ratón, teclado, toque
y scroll. Está en `AUTO_LOCK_MS`, al principio de `VaultContext.tsx`.

**El módulo criptográfico se importa de forma diferida** (`await import(...)`)
dentro de cada operación. libsodium carga WASM y revienta en el render de
servidor; así nunca se carga en SSR ni en quien no llegue a usar la bóveda.

---

## Pendiente que no es de esta etapa

Sigue abierto de la Etapa 3: cambiar en `FirestoreContext` las dos consultas
`query(collection("users"), where("user.uid","==",uid))` por `getDoc`. Sin eso,
las reglas rompen el login en producción.

Y de la Etapa 1: volver a medir la memoria en el móvil con el archivo de 286 MB
para corregir el número del README de Fase 0.
