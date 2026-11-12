import { FC, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { AuthContext, FirestoreContext } from "../../context";
import { PasosOnboarding } from "../ui/PasosOnboarding";
import { BarraProgreso, IconoPaso } from "../ui/Paso";

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

  /* Fila de dato como en 6b: etiqueta normal a la izquierda, valor en
     negrita a la derecha; la fecha en mono. */
  const dato = (etiqueta: string, valor: string, mono = false, ultima = false) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 14px",
        borderBottom: ultima ? "none" : "1px solid var(--border)",
      }}
    >
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--slate-700)" }}>{etiqueta}</span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: mono ? 13 : 14,
          fontWeight: mono ? 400 : 600,
          letterSpacing: mono ? "0.04em" : undefined,
          textTransform: mono ? "uppercase" : undefined,
          color: "var(--ink-900)",
        }}
      >
        {valor}
      </span>
    </div>
  );

  return (
    <div className="br-root br-split">
      {/* Pasos a la izquierda en escritorio, como en 7c–7e. En móvil no se
          pinta: antes dejaba un bloque beige vacío bajo el botón. */}
      <aside
        className="br-aside br-solo-escritorio"
        style={{ borderLeft: "none", background: "var(--ink-900)" }}
      >
        <div className="br-aside-inner" style={{ width: "100%" }}>
          <PasosOnboarding actual={2} />
        </div>
      </aside>

      <div className="br-split-main br-movil-alto">
        <div className="br-split-inner" style={{ maxWidth: 460 }}>
          {/* Barra de progreso con el plan hecho (6b), en vez de un «Paso 2
              de 3» que repetía el número de la pantalla siguiente (5a). */}
          <div style={{ marginBottom: 32 }}>
            <BarraProgreso hechos={1} />
          </div>

          <IconoPaso tipo="check" tono="suave" redondo />
          <h1 className="br-page-title" style={{ marginTop: 24 }}>{t("Tu plan está activo")}</h1>
          <p style={{ margin: "0 0 24px", fontSize: 15.5, color: "var(--slate-700)" }}>
            {user?.email
              ? /* El correo en negrita (6b): es donde hay que ir a buscar el recibo. */
                (() => {
                  const c = user.email as string;
                  const frase = enTexto(t("Te enviamos el recibo a {{correo}}.", { correo: c }));
                  const i = frase.indexOf(c);
                  if (i < 0) return frase;
                  return (
                    <>
                      {frase.slice(0, i)}
                      <strong style={{ fontWeight: 600, color: "var(--ink-900)" }}>{c}</strong>
                      {frase.slice(i + c.length)}
                    </>
                  );
                })()
              : t("Te enviamos el recibo por correo.")}
          </p>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-raised)" }}>
            {dato(
              enTexto(t("Plan")),
              plan
                ? `${plan.details.name} · $${plan.details.price}/${t("mes")}`
                : "Personal · $2.99/" + t("mes")
            )}
            {dato(enTexto(t("Próximo cobro")), fecha, true, true)}
          </div>

          {/* Se anuncia el siguiente paso antes de llevar a él, abajo junto
              al botón (6b). */}
          <div className="br-movil-abajo">
            <p style={{ margin: "0 0 12px", fontSize: 14.5, color: "var(--slate-700)", lineHeight: 1.5 }}>
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
      </div>
    </div>
  );
};

export default PlanActivoScreen;
