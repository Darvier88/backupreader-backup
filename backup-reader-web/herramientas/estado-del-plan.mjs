/**
 * Copia en JavaScript de `estadoDelPlan` (lib/sincronizar-plan.ts) para los
 * scripts de herramientas/, que corren con node sin compilar TypeScript.
 *
 * Tiene que decidir EXACTAMENTE lo mismo que la versión de la web:
 * tests/planes/estadoDelPlan.test.ts pasa los mismos casos por las dos.
 */

const CON_ACCESO = ["active", "trialing", "past_due"];

const planDe = (s) => {
  const item = s.items?.data?.[0];
  return (item?.plan?.id ?? item?.price?.id) || null;
};

const centavosDe = (s) => {
  const item = s.items?.data?.[0];
  const n = item?.price?.unit_amount ?? item?.plan?.amount;
  return typeof n === "number" ? n : null;
};

export function estadoDelPlan(subs, ahora = Date.now()) {
  const conAcceso = subs.filter((s) => CON_ACCESO.includes(s.status) && planDe(s));
  if (conAcceso.length > 0) {
    const finDe = (s) => s.cancel_at ?? (s.cancel_at_period_end ? s.current_period_end : null);
    conAcceso.sort((a, b) => {
      const fa = finDe(a);
      const fb = finDe(b);
      if (!fa !== !fb) return fa ? 1 : -1;
      return (b.current_period_end ?? 0) - (a.current_period_end ?? 0);
    });
    const mejor = conAcceso[0];
    const fin = finDe(mejor);
    return { tipo: "plan", plan: planDe(mejor), centavos: centavosDe(mejor), planCancelAt: fin ? fin * 1000 : null };
  }

  const terminadas = subs.filter(
    (s) => ["canceled", "unpaid", "incomplete_expired"].includes(s.status) && planDe(s)
  );
  if (terminadas.length > 0) {
    const finDe = (s) => s.ended_at ?? s.canceled_at ?? s.current_period_end ?? Math.floor(ahora / 1000);
    terminadas.sort((a, b) => finDe(b) - finDe(a));
    const ultima = terminadas[0];
    const fin = Math.min(finDe(ultima) * 1000, ahora);
    return { tipo: "plan", plan: planDe(ultima), centavos: centavosDe(ultima), planCancelAt: fin };
  }

  return { tipo: "sin-cambios" };
}
