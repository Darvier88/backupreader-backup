import { FC, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { AuthContext, FirestoreContext } from "../../context";
import { PasosOnboarding } from "../ui/PasosOnboarding";

/**
 * Plan activo (pantalla 6b).
 *
 * POR QUÉ HACE FALTA UNA PANTALLA Y NO UN REDIRECCIÓN
 * ---------------------------------------------------
 * Antes, al terminar el pago se iba directo a `/dashboard`. Dos problemas.
 *
 * El primero es que el cobro desaparecía sin acuse. Acabas de pagar y lo
 * siguiente que ves es la aplicación, sin que nada te confirme a qué correo
 * va el recibo ni cuándo es el próximo cargo. Esa es justo la información que
 * la gente busca inmediatamente después de pagar, y no encontrarla es lo que
 * genera el correo a soporte preguntando si el pago entró.
 *
 * El segundo es la clave de cifrado. Lo siguiente que la aplicación le pide al
 * usuario es inventarse una contraseña que, si la pierde, hace sus chats
 * irrecuperables. Llegar a esa pantalla de sopetón, justo después de pagar y
 * sin avisar, es la peor forma posible de presentarla: se lee como un trámite
 * más y se elige cualquier cosa. Anunciarla aquí la convierte en el último
 * paso de algo que ya se sabía que tenía tres.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const PlanActivoScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { subscription, planId } = useContext(FirestoreContext);

  const plan = subscription?.find((it: any) => it.id === planId);

  /* La fecha del próximo cobro se calcula a un mes vista.
     Lo exacto lo sabe Stripe, pero aquí no hay nada que lo consulte, y una
     fecha aproximada con el mes correcto informa mucho más que no decir nada:
     lo que la gente quiere saber es "cuándo me vuelven a cobrar", no el día
     exacto. Si algún día entra el webhook de Stripe, esto se sustituye por la
     fecha real que el propio Stripe manda. */
  const proximo = new Date();
  proximo.setMonth(proximo.getMonth() + 1);
  const fecha = proximo.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const dato = (etiqueta: string, valor: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--slate-500)",
        }}
      >
        {etiqueta}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink-900)" }}>
        {valor}
      </span>
    </div>
  );

  return (
    <div className="br-root br-split">
      <div className="br-split-main">
        <div className="br-split-inner" style={{ maxWidth: 460 }}>
          <div style={{ marginBottom: 10 }}>
            <PasosOnboarding actual={2} variante="linea" />
          </div>

          <h1 className="br-page-title">{t("Tu plan está activo")}</h1>
          <p style={{ margin: "0 0 24px", fontSize: 15.5, color: "var(--slate-700)" }}>
            {user?.email
              ? enTexto(t("Te enviamos el recibo a {{correo}}.", { correo: user.email }))
              : t("Te enviamos el recibo por correo.")}
          </p>

          <div className="br-card" style={{ padding: "6px 20px 14px" }}>
            {dato(
              enTexto(t("Plan")),
              plan
                ? `${plan.details.name} · $${plan.details.price}/${t("mes")}`
                : "Personal · $2.99/" + t("mes")
            )}
            {dato(enTexto(t("Próximo cobro")), fecha)}
          </div>

          {/* Se anuncia el siguiente paso antes de llevar a él. */}
          <p
            style={{
              margin: "24px 0 14px",
              fontSize: 15.5,
              color: "var(--slate-700)",
              lineHeight: 1.5,
            }}
          >
            {t("Último paso: crea la clave con la que ciframos tus chats.")}
          </p>

          <button
            type="button"
            className="br-btn br-btn-primary br-btn-lg"
            style={{ width: "100%", minHeight: 52, cursor: "pointer" }}
            onClick={() => router.replace("/dashboard")}
          >
            {t("Crear clave de cifrado")}
          </button>
        </div>
      </div>

      <aside className="br-aside">
        <div className="br-aside-inner">
          <div className="br-solo-escritorio">
            <PasosOnboarding actual={2} />
          </div>
        </div>
      </aside>
    </div>
  );
};

export default PlanActivoScreen;
