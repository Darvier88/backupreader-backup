import { FC, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { FirestoreContext } from "../../context";

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

const asideItems = (t: (k: string) => string) => [
  { img: "/redesign/cancel-at-any-time.svg", title: t("Cancela cuando quieras"), text: t("Sin contratos ni penalizaciones. Detén tu suscripción desde tu cuenta cuando lo decidas.") },
  { img: "/redesign/information-will-always-be-yours.svg", title: t("Tu información siempre será tuya"), text: t("Tú decides qué guardar y qué borrar. Elimina tu cuenta y todo lo que contiene se va contigo.") },
];

export const PlansScreen: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { subscription, setPlanId } = useContext(FirestoreContext);

  const onHandlePlanSelected = (planId: string) => {
    setPlanId(planId);
    router.push("/payment");
  };

  const plan = subscription?.find((it: any) => it.details.price === 2.99);

  return (
    <div className="br-root br-split">
      {/* Columna del plan */}
      <div className="br-split-main">
        <div className="br-split-inner">
          <h1 className="br-page-title">{t("Selecciona tu Plan")}</h1>
          <p className="br-page-sub">{t("Puedes cancelar tu suscripción en cualquier momento")}</p>

          {plan ? (
            <div className="br-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "24px 26px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>{plan.details.name}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-800)", background: "var(--paper-200)", borderRadius: 100, padding: "5px 14px" }}>{plan.details.frequently}</span>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 42, letterSpacing: "-0.02em", color: "var(--ink-900)" }}>${plan.details.price}</span>
                  <span style={{ fontSize: 15, color: "var(--text-muted)" }}>/ {t("mes")}</span>
                </div>
              </div>
              <ul style={{ margin: 0, padding: "22px 26px", listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{plan.details.benefit}</span></li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{t("Conversaciones de hasta")} {plan.details.storage} {t("MB cada una")}</span></li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{t("Lee tus chats offline, cuando quieras")}</span></li>
              </ul>
              <div style={{ padding: "0 26px 26px" }}>
                <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={() => onHandlePlanSelected(plan.id)}>
                  {t("Suscribirme")}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--slate-500)" }}>{t("Cargando planes...")}</p>
          )}

          <p className="br-fineprint" style={{ marginTop: 24 }}>
            {t("La facturación empieza hoy. Cancela desde tu cuenta cuando quieras; tus backups siguen siendo legibles hasta que termine el periodo.")}
          </p>
        </div>
      </div>

      {/* Aside ilustrado */}
      <aside className="br-aside">
        <div className="br-aside-inner">
          {asideItems(t).map((it, i) => (
            <div key={i} className="br-aside-item">
              <img src={it.img} alt="" />
              <h2>{it.title}</h2>
              <p>{it.text}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
