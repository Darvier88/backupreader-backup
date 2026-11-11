import { FC, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { FirestoreContext } from "../../context";
import { BarraProgreso, Trazo } from "../ui/Paso";
import { Logo } from "../ui/BrandChrome";
import { AuthContext } from "../../context";
import { PasosOnboarding } from "../ui/PasosOnboarding";

/* ============================================================================
   Selecciona tu plan — rediseño "Expediente".
   Conserva la lógica: mapea `subscription`, filtra el plan de $2.99, y al
   suscribirse hace setPlanId(id) + router.push("/payment").
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);


const enTexto = (traducido: unknown): string => (traducido as string | null | undefined) ?? "";

export const PlansScreen: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { subscription, setPlanId } = useContext(FirestoreContext);
  const { logOut } = useContext(AuthContext);

  const onHandlePlanSelected = (planId: string) => {
    setPlanId(planId);
    router.push("/payment");
  };

  const plan = subscription?.find((it: any) => it.details.price === 2.99);

  return (
    <div className="br-root br-split">
      {/* La columna de pasos va a la IZQUIERDA (7c).
          El orden importa: primero cuántos pasos quedan y luego lo que hay
          que hacer ahora. Al revés, se decide el plan sin saber que después
          vienen dos pantallas más, que es justo donde la gente abandona.
          En móvil se apila debajo, que es donde estorba menos. */}
      {/* Columna de pasos en tinta (7c), solo en escritorio y SOLO con los
          pasos: es el mismo momento que 7d y 7e, y las láminas de
          «Cancela cuando quieras» / «Tu información siempre será tuya»
          repetían lo que ya dice el plan. En móvil no se pinta: allí basta
          la línea «Cuenta creada · Paso 1 de 3» sobre el título (6a). */}
      <aside
        className="br-aside br-solo-escritorio"
        style={{ borderLeft: "none", background: "var(--ink-900)" }}
      >
        {/* Logo arriba, los pasos y «Ayuda · Salir» abajo (7c). */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 400, margin: "0 auto" }}>
          <Logo oscuro onClick={() => router.push("/")} />
          <div style={{ flex: 1, marginTop: 20 }}>
            <PasosOnboarding actual={1} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="br-enlace-panel" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => router.push("/help")}>
              {t("Ayuda")}
            </button>
            <button type="button" className="br-enlace-panel" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => logOut()}>
              {t("Salir")}
            </button>
          </div>
        </div>
      </aside>
      {/* Columna del plan */}
      <div className="br-split-main br-movil-alto">
        <div className="br-split-inner">
          {/* Cuantos pasos faltan, antes del titulo (6a y 7c).
              Despues de pagar viene crear la clave de cifrado y confirmarla.
              Sin saberlo, cada pantalla nueva parece un obstaculo mas y es
              donde la gente abandona: no por lo que se le pide, sino porque no
              sabe si se le va a seguir pidiendo cosas. */}
          {/* Barra de los tres pasos en móvil (6a). */}
          <div className="br-solo-movil" style={{ marginBottom: 22 }}>
            <BarraProgreso hechos={1} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <PasosOnboarding actual={1} variante="linea" />
          </div>
          <h1 className="br-page-title">{t("Activa tu plan")}</h1>
          <p className="br-page-sub">{t("Cancela cuando quieras, sin trámites.")}</p>

          {plan ? (
            <div className="br-card" style={{ overflow: "hidden", border: "1.5px solid var(--brass-500)" }}>
              <div style={{ padding: "24px 26px 20px", borderBottom: "1px solid var(--border)" }}>
                {/* Sin la píldora "Mes".
                    Debajo ya pone "$2.99 / mes", así que la píldora repetía
                    el periodo con otras palabras y en otro sitio, y una
                    píldora destacada suele significar "esto es distinto de lo
                    normal" —una oferta, un plan recomendado—, que aquí no es
                    el caso: solo hay un plan. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>{plan.details.name}</span>
                  {/* Marca de plan elegido (6a). */}
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, background: "var(--brass-500)", color: "var(--paper-50)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Trazo tipo="check" tam={14} />
                  </span>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 42, letterSpacing: "-0.02em", color: "var(--ink-900)" }}>${plan.details.price}</span>
                  <span style={{ fontSize: 15, color: "var(--text-muted)" }}>USD / {t("mes")}</span>
                </div>
              </div>
              <ul style={{ margin: 0, padding: "22px 26px", listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{plan.details.benefit}</span></li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{enTexto(t("Hasta {{n}} MB por conversación", { n: plan.details.storage }))}</span></li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{t("Lee tus chats sin conexión, cuando quieras")}</span></li>
                {/* El cifrado es la razón por la que alguien elige esto en
                    vez de dejar el .zip en su nube, así que es un punto de la
                    lista y no una nota al pie. */}
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{t("Cifrado con una clave que solo tú conoces")}</span></li>
              </ul>
            </div>
          ) : (
            <p style={{ color: "var(--slate-500)" }}>{t("Cargando planes...")}</p>
          )}

          {/* El pago abajo, siempre a la vista, con el texto del cobro
              debajo del botón (6a, 7c). */}
          <div className="br-movil-abajo">
          {plan && (
                <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={() => onHandlePlanSelected(plan.id)}>
                  {(t("Suscribirme · ${{precio}}/mes", { precio: plan.details.price }) as string) || "Suscribirme"}
                </button>
          )}
          <p className="br-fineprint" style={{ marginTop: 14, textAlign: "center" }}>
            {t("El cobro empieza hoy. Cancela desde tu cuenta cuando quieras.")}{" "}
            {t("Pago seguro con tarjeta, Apple Pay o Google Pay.")}
          </p>
          </div>
        </div>
      </div>

    </div>
  );
};
