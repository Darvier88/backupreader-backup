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
          {/* Solo en móvil (6a). En escritorio la columna en tinta ya dice en
              qué paso se está, y el diseño (7c) no repite la línea. */}
          <div className="br-solo-movil" style={{ marginBottom: 10 }}>
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
                {/* La marca de plan elegido (6a) va pegada al nombre, no en
                    la esquina: allí chocaba con la ilustración, que ocupa ese
                    mismo rincón derecho. */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden style={{ width: 20, height: 20, borderRadius: 999, background: "var(--brass-500)", color: "var(--paper-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trazo tipo="check" tam={13} />
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>{plan.details.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 42, letterSpacing: "-0.02em", color: "var(--ink-900)" }}>${plan.details.price}</span>
                    <span style={{ fontSize: 15, color: "var(--text-muted)" }}>USD / {t("mes")}</span>
                  </div>
                  {/* La ilustración, solo en escritorio (7c).
                      En móvil la tarjeta ya ocupa casi toda la pantalla y un
                      dibujo de 108px empuja el precio y las ventajas fuera
                      del primer pantallazo, que es justo lo que hay que ver
                      antes de decidir. */}
                  <img
                    className="br-solo-escritorio"
                    src="/redesign/free-space-from-your-phone.svg"
                    alt=""
                    style={{ width: 108, height: "auto", marginBottom: -4, flexShrink: 0 }}
                  />
                </div>
              </div>
              {/* Dos columnas donde hay ancho (7c).
                  Son cuatro frases cortas: en una sola columna la tarjeta se
                  estira hasta empujar el botón de suscribirse fuera de la
                  pantalla, y lo que hay que poder ver de una vez es el precio
                  junto a lo que incluye. `br-ventajas-plan` las apila otra
                  vez por debajo de 720px. */}
              {/* La ventaja del plan pasa por t().
                  Viene de Firestore, así que el texto está en español
                  venga de donde venga: en inglés, la tarjeta mezclaba
                  «Respalda tus conversaciones en la nube» con el resto de
                  la lista traducida. i18next devuelve la propia cadena
                  cuando no hay traducción, así que un plan nuevo con otra
                  frase sigue saliendo tal cual en vez de romperse. */}
              <ul className="br-ventajas-plan" style={{ margin: 0, padding: "22px 26px", listStyle: "none" }}>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Check /><span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{enTexto(t(plan.details.benefit))}</span></li>
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
            {/* Sin mencionar Apple Pay ni Google Pay: el pago es solo con
                tarjeta, y nombrar aquí un método que luego no aparece en el
                formulario es la clase de promesa que hace abandonar justo en
                la pantalla siguiente. */}
            {t("El cobro empieza hoy. Cancela desde tu cuenta cuando quieras.")}{" "}
            {t("Pago seguro con tarjeta.")}
          </p>
          </div>
        </div>
      </div>

    </div>
  );
};
