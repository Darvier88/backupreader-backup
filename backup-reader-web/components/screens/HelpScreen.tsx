import { FC, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext";

/* ============================================================================
   Página de Ayuda / Tutorial — rediseño "Expediente".
   Conserva las claves t("..."), los videos, la lógica de sesión (isLoggedIn)
   y el bloque de "cómo elimino mi cuenta". Estilos con tokens globales.
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

export const HelpScreen: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { status } = useContext(AuthContext);
  const isLoggedIn = status === "autheticated";

  const steps = [
    {
      index: "Paso 01",
      video: "videos/Backup Reader - Primer Paso_051724.mp4",
      title: t("Primer paso - Exportar el chat desde WhatsApp"),
      body: t("1) Abre Whatsapp, 2) Presiona sobre el chat que quieres hacer backup, 3) Presiona sobre el nombre (en la parte de superior), 4) En la parte de abajo encontrarás la opción 'Exportar chat', 5) Selecciona 'Adjuntar archivos', 6) Selecciona en la parte inferior (Guardar en archivos)"),
    },
    {
      index: "Paso 02",
      video: "videos/Backup Reader - Segundo Paso_051724.mp4",
      title: t("Segundo paso - Sube tu backup"),
      body: t("1) Subir chat, 2) Seleccionar archivos, 3) Busca el chat que subimos en el paso 1, 4) Presiona sobre el chat, 5) Presiona 'Abrir' en la parte superior derecha, listo, ya tienes tu primer backup."),
    },
  ];

  return (
    <div className="br-root">
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(16px,4vw,24px) 80px" }}>

        <span className="br-section-label br-section-label-accent">How it works</span>
        <h1 style={{ margin: "16px 0 40px", fontFamily: serif, fontWeight: 500, fontSize: "clamp(26px,3.6vw,38px)", lineHeight: 1.14, letterSpacing: "-0.02em", color: "var(--ink-900)" }}>
          {t("Guía Rápida para Crear tu Backup de WhatsApp")}
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {steps.map((s, i) => (
            <article key={i} className="br-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: "16 / 10", background: "var(--ink-900)", borderBottom: "1px solid var(--border)" }}>
                <video src={s.video} controls style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ padding: "26px 26px 30px", display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>{s.index}</span>
                <h3 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: "var(--ink-900)" }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "var(--slate-700)" }}>{s.body}</p>
              </div>
            </article>
          ))}
        </div>

        {!isLoggedIn && (
          <div className="br-card" style={{ marginTop: 40, background: "var(--ink-900)", border: "none", padding: "clamp(32px,5vw,48px)", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: "clamp(24px,3vw,32px)", letterSpacing: "-0.015em", color: "var(--paper-50)" }}>
              {t("Backup de tus recuerdos")}
            </h2>
            <p style={{ margin: "14px auto 26px", fontSize: 16, lineHeight: 1.6, color: "var(--ink-100)", maxWidth: "44ch" }}>
              {t("Crea una cuenta y empieza a respaldar tus chats de forma segura.")}
            </p>
            <button className="br-btn br-btn-primary br-btn-lg" onClick={() => router.push("/auth")}>
              {t("Comienza ahora")}
            </button>
          </div>
        )}

        <div style={{ marginTop: 56, borderTop: "1px solid var(--border)", paddingTop: 40 }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(20px,2.6vw,26px)", letterSpacing: "-0.015em", color: "var(--ink-900)", margin: "0 0 12px" }}>
            {t("¿Cómo elimino mi cuenta?")}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--slate-700)", margin: 0 }}>
            {t("Envía un correo a info@backupreader.com con la dirección de correo con la que te registraste, eliminaremos toda tu información y la suscripción.")}
          </p>
        </div>

      </div>
    </div>
  );
};