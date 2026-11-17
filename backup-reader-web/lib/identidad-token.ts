/**
 * Quién llama a un endpoint, a partir de su ID token de Firebase.
 *
 * Se verifica con la API REST de Identity Toolkit y no con firebase-admin:
 * así funciona aunque Vercel no tenga cuenta de servicio, porque solo
 * necesita la API key pública. (Salió de subscriptions/cancel para que la
 * usen también subscriptions/sync.)
 */

/**
 * Dónde se verifica el token.
 *
 * Normalmente, el Identity Toolkit de Google. Pero con los emuladores los
 * tokens son falsos y sin firmar, así que Google los rechaza y la cancelación
 * no se puede probar en local. El emulador de Auth expone esta misma API bajo
 * su propio host, de modo que apuntando ahí se sigue VERIFICANDO de verdad,
 * solo que contra el emulador.
 *
 * Esto no es un atajo que se salte la comprobación: la doble condición es
 * deliberada. En Vercel `NODE_ENV` vale siempre "production", así que este
 * camino no se puede activar en el sitio desplegado ni aunque alguien dejara
 * la variable del emulador puesta por error.
 */
function urlDeVerificacion(apiKey: string): string {
  const enEmulador =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

  if (enEmulador) {
    const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
    return `http://${host}:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  }
  return `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
}

/** Verifica el ID token contra Firebase. Devuelve uid y correo, o null. */
export async function identidadDelToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("Falta NEXT_PUBLIC_FIREBASE_API_KEY: no se puede verificar quién llama.");
    return null;
  }
  try {
    const r = await fetch(
      urlDeVerificacion(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const u = data?.users?.[0];
    if (!u?.localId) return null;
    return { uid: u.localId, email: u.email ?? "" };
  } catch (err) {
    console.error("No se pudo verificar el token:", err);
    return null;
  }
}

