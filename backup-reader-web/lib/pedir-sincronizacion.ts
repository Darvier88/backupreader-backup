import { FirebaseAuth } from "../config/firebase";

/**
 * Le pide al servidor que ponga el plan al día con Stripe
 * (pages/api/subscriptions/sync).
 *
 * Devuelve qué pasó:
 *  - `servidor`: el servidor escribió (o comprobó) el plan; hay que releer
 *    el usuario. `plan` es el que quedó.
 *  - `sin-admin`: Vercel no tiene cuenta de servicio; quien llama escribe el
 *    plan él mismo, como antes.
 *  - `fallo`: no se pudo (sin sesión, sin red, Stripe caído).
 */
export type Sincronizacion =
  | { tipo: "servidor"; cambiado: boolean; plan: string | null; planCancelAt: number | null }
  | { tipo: "sin-admin" }
  | { tipo: "fallo" };

export async function pedirSincronizacion(): Promise<Sincronizacion> {
  const actual = FirebaseAuth.currentUser;
  if (!actual) return { tipo: "fallo" };
  try {
    const idToken = await actual.getIdToken();
    const r = await fetch("/api/subscriptions/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.ok) return { tipo: "fallo" };
    if (!d.escritoEnServidor) return { tipo: "sin-admin" };
    return { tipo: "servidor", cambiado: Boolean(d.cambiado), plan: d.plan ?? null, planCancelAt: d.planCancelAt ?? null };
  } catch {
    return { tipo: "fallo" };
  }
}
