import { FirebaseAuth } from "../../config/firebase";

/**
 * Llamar a un endpoint de administración.
 *
 * Todos reciben el ID token en el cuerpo y lo verifican en el servidor, así
 * que el ritual es siempre el mismo y mejor en un sitio solo.
 *
 * `getIdToken(true)` fuerza un token recién emitido. Los endpoints de
 * administración verifican además que la sesión no esté revocada, y un token
 * viejo de la caché daría un 401 que parece un fallo de permisos cuando en
 * realidad solo era un token caducado.
 */
export async function llamarAdmin<T = any>(
  ruta: string,
  cuerpo: Record<string, unknown> = {}
): Promise<{ estado: number; datos: T | null }> {
  const actual = FirebaseAuth.currentUser;
  if (!actual) return { estado: 401, datos: null };

  const idToken = await actual.getIdToken(true);
  const r = await fetch(`/api/admin/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...cuerpo }),
  });

  let datos: T | null = null;
  try {
    datos = await r.json();
  } catch {
    /* Un 500 sin cuerpo, o una respuesta cortada por el límite de tiempo de
       la función. Se devuelve el estado para que quien llame lo distinga de
       un fallo con explicación. */
  }
  return { estado: r.status, datos };
}

/** Centavos a algo legible. Stripe trabaja en la unidad menor de la moneda. */
export function dinero(centavos: number, moneda: string | null): string {
  const valor = (centavos / 100).toFixed(2);
  return `${valor} ${(moneda || "usd").toUpperCase()}`;
}

export function bytes(n: number): string {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fecha(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
