import { FC, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

/* ============================================================================
   Landing rediseñado — dirección "Expediente" (navy + papel + verdigris).
   Conserva TODAS las claves de traducción t("...") originales (ES/EN) y las
   rutas (/auth, /privacyPolicy, /termsConditions) y los videos del tutorial.
   Estilos con los tokens globales de styles/backupreader-design.css.
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

/* Acordeón FAQ estilo Expediente: fondo papel, divisoria fina, +/- , serif */
const FaqItem: FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "22px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(17px,2vw,20px)", color: "var(--ink-900)", lineHeight: 1.3 }}>{q}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M5 12h14" />
          {!open && <path d="M12 5v14" />}
        </svg>
      </button>
      {open && (
        <p style={{ margin: "0 4px 24px", fontSize: 15.5, lineHeight: 1.65, color: "var(--slate-700)" }}>{a}</p>
      )}
    </div>
  );
};

const features = (t: (k: string) => string) => [
  {
    label: "Media",
    img: "/redesign/review-photos-text-of-a-whatsapp-conversation.svg",
    title: t("Respalda fotos, audios, videos, documentos y chats"),
    text: t("Con nuestro servicio de almacenamiento en la nube, respalda tus fotos, audios, videos, documentos y chats de manera segura y conveniente. No deberás preocuparte por perder tus momentos más preciados. Almacenamos tus archivos de forma segura en la nube, garantizando que tus recuerdos estén protegidos contra cualquier pérdida accidental."),
  },
  {
    label: "Storage",
    img: "/redesign/free-space-from-your-phone.svg",
    title: t("Libera espacio en tu teléfono"),
    text: t("Hacer backup de tus chats en la nube no solo promueve la seguridad de tus datos, sino que también te ayuda a liberar espacio valioso en tu teléfono. Al realizar copias de seguridad en la nube, puedes eliminar chats de tu teléfono de forma segura, sin preocuparte por perder información importante."),
  },
  {
    label: "History",
    img: "/redesign/multiple-versions-of-a-chat.svg",
    title: t("Múltiples Versiones"),
    text: t("El backup de chats en la nube ofrece la ventaja de conservar múltiples versiones de tus interacciones con una misma persona. Al tener la capacidad de guardar estos chats cuantas veces desees, puedes mantener un archivo histórico ordenado por fecha."),
  },
];

const accordionData = (t: (k: string) => string) => [
  { title: t("¿Qué es Backup Reader?"), textContent: t("Backup Reader es un servicio en línea que te permite leer, extraer y almacenar de manera segura chats de WhatsApp en la nube manteniendo un orden cronológico y, sobre todo, manteniendo el acceso a los audios, imágenes y links dentro de la misma copia del chat.") },
  { title: t("¿Cuál es la diferencia entre Backup Reader y otros servicios de almacenamiento en la nube?"), textContent: t("Backup Reader está diseñado específicamente para backups de redes sociales, por lo que vas a poder leer tus chats como si estuvieras utilizando la red social normalmente, permitiéndote acceder a todo el contenido de los chats, como fotos, audios, videos, etc. Además, no necesitas hacer backup de todos los chats, puedes seleccionar solo aquellos que te importen más. Un beneficio adicional es que al diversificar el almacenamiento de tus recuerdos, estos se vuelven menos vulnerables, ya que no están concentrados en un solo lugar, aumentando así la seguridad y la disponibilidad de tu información.") },
  { title: t("¿Qué sucede si elimino WhatsApp?"), textContent: t("Tus chats estarán seguros en Backup Reader, por lo que puedes acceder a tus chats en cualquier momento.") },
  { title: t("Si elimino mi cuenta de Backup Reader, ¿se eliminan también chats?"), textContent: t("Sí, toda tu información se elimina una vez que eliminas tu cuenta de Backup Reader.") },
];

const tutorialSteps = (t: (k: string) => string) => [
  { index: "Paso 01", video: "videos/Backup Reader - Primer Paso.mp4", title: t("Primer paso - Exportar el chat desde WhatsApp"), body: t("1) Abre Whatsapp, 2) Presiona sobre el chat que quieres hacer backup, 3) Presiona sobre el nombre (en la parte de superior), 4) En la parte de abajo encontrarás la opción 'Exportar chat', 5) Selecciona 'Adjuntar archivos', 6) Selecciona en la parte inferior (Guardar en archivos)") },
  { index: "Paso 02", video: "videos/Backup Reader - Segundo Paso.mp4", title: t("Segundo paso - Sube tu backup"), body: t("1) Subir chat, 2) Seleccionar archivos, 3) Busca el chat que subimos en el paso 1, 4) Presiona sobre el chat, 5) Presiona 'Abrir' en la parte superior derecha, listo, ya tienes tu primer backup.") },
];

export const HomeScreen: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const goAuth = () => router.push("/auth");

  return (
    <div className="br-root">
      {/* HERO */}
      <section className="br-section-ink" style={{ overflow: "hidden" }}>
        <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(56px,8vw,96px) clamp(16px,4vw,24px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "clamp(32px,5vw,64px)", alignItems: "center" }}>
          <div>
            <span className="br-section-label br-section-label-paper">Cloud backup · WhatsApp</span>
            <h1 style={{ margin: "18px 0 0", fontFamily: serif, fontWeight: 500, fontSize: "clamp(32px,5.2vw,52px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--paper-50)" }}>
              {t("¿Qué ocurre si WhatsApp se cae o te roban el teléfono?")}
            </h1>
            <p style={{ margin: "22px 0 0", fontSize: "clamp(16px,1.6vw,17.5px)", lineHeight: 1.65, color: "var(--ink-100)", maxWidth: "52ch" }}>
              {t("No pierdas tus recuerdos. Con nuestro servicio, puedes guardar mensajes, fotos, videos, documentos y enlaces de cualquier chat o grupo, liberando espacio en tu teléfono y manteniendo tus chats fácilmente accesibles incluso si Whatsapp no está disponible.")}
            </p>
            <div style={{ marginTop: 32, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button className="br-btn br-btn-primary br-btn-lg" onClick={goAuth}>{t("Comienza ahora")}</button>
              <a href="#features" className="br-btn br-btn-inverse br-btn-lg">{t("Lee chats sin estar en línea")}</a>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img src="/redesign/reviewing-a-whatsapp-conversation.svg" alt="WhatsApp backup" style={{ width: "100%", maxWidth: 480, height: "auto" }} />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="br-section">
        <span className="br-section-label br-section-label-accent">What you get</span>
        <h2 style={{ margin: "16px 0 44px", fontFamily: serif, fontWeight: 500, fontSize: "clamp(27px,3.4vw,36px)", lineHeight: 1.18, letterSpacing: "-0.015em", color: "var(--ink-900)", maxWidth: "24ch" }}>
          {t("Respalda fotos, audios, videos, documentos y chats")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(258px, 1fr))", gap: 24 }}>
          {features(t).map((f, i) => (
            <article key={i} className="br-card" style={{ padding: "28px 26px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
              <img src={f.img} alt="" style={{ width: "100%", maxWidth: 260, height: 150, objectFit: "contain", objectPosition: "left center", marginBottom: 4 }} />
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>{f.label}</span>
              <h3 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: 22, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--ink-900)" }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "var(--slate-700)" }}>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* OFFLINE */}
      <section className="br-section-ink">
        <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(56px,7vw,88px) clamp(16px,4vw,24px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
          <div>
            <span className="br-section-label br-section-label-paper">Offline access</span>
            <h2 style={{ margin: "16px 0 0", fontFamily: serif, fontWeight: 500, fontSize: "clamp(28px,3.6vw,38px)", lineHeight: 1.14, letterSpacing: "-0.015em", color: "var(--paper-50)" }}>
              {t("Lee chats sin estar en línea")}
            </h2>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "var(--ink-100)" }}>
              {t("Backup Reader te permite mantener una copia segura y accesible de tus mensajes, fotos, videos, audios y documentos, completamente independiente de los servidores de WhatsApp. Esto asegura que tu información permanezca disponible incluso cuando WhatsApp esté fuera de servicio o no lo estés utilizando.")}
            </p>
            <div style={{ marginTop: 26 }}>
              <button className="br-btn br-btn-primary br-btn-md" onClick={goAuth}>{t("Comienza ahora")}</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(56px,8vw,96px) clamp(16px,4vw,24px)" }}>
        <span className="br-section-label br-section-label-accent">Questions</span>
        <h2 style={{ margin: "16px 0 36px", fontFamily: serif, fontWeight: 500, fontSize: "clamp(26px,3.2vw,34px)", letterSpacing: "-0.015em", color: "var(--ink-900)" }}>
          {t("Preguntas frecuentes")}
        </h2>
        {accordionData(t).map((item, i) => (
          <FaqItem key={i} q={item.title} a={item.textContent} />
        ))}
        <div style={{ borderTop: "1px solid var(--border)" }} />
      </section>

      {/* TUTORIAL */}
      <section id="tutorial" style={{ background: "var(--paper-100)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(56px,7vw,88px) clamp(16px,4vw,24px)" }}>
          <span className="br-section-label br-section-label-accent">How it works</span>
          <h2 style={{ margin: "16px 0 10px", fontFamily: serif, fontWeight: 500, fontSize: "clamp(26px,3.2vw,34px)", letterSpacing: "-0.015em", color: "var(--ink-900)" }}>
            {t("Aprende cómo usar Backup Reader")}
          </h2>
          <p style={{ margin: "0 0 40px", fontSize: 16.5, color: "var(--slate-700)" }}>
            {t("En dos sencillos pasos aprende a utilizar Backup Reader y haz tu primer backup.")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {tutorialSteps(t).map((s, i) => (
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
        </div>
      </section>

      {/* ANALIZA TU X */}
      <section id="analyze-x" style={{ background: "var(--paper-50)" }}>
        <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(48px,6vw,76px) clamp(16px,4vw,24px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
          <div>
            <span className="br-section-label br-section-label-accent">{t("Nuevo · Backup Reader X")}</span>
            <h2 style={{ margin: "16px 0 0", fontFamily: serif, fontWeight: 500, fontSize: "clamp(27px,3.4vw,36px)", lineHeight: 1.16, letterSpacing: "-0.015em", color: "var(--ink-900)", maxWidth: "26ch" }}>
              {t("Descubre qué dice tu historial de X sobre ti hoy")}
            </h2>
            <p style={{ margin: "18px 0 0", fontSize: "clamp(15.5px,1.6vw,17px)", lineHeight: 1.65, color: "var(--slate-700)", maxWidth: "54ch" }}>
              {t("Conecta tu cuenta de X y Backup Reader analiza tus propias publicaciones con inteligencia artificial, señalando lo que probablemente ya no te representa. Tú lo ves primero, nadie más, y tú decides qué hacer.")}
            </p>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                t("Acceso de solo lectura a tu propia cuenta"),
                t("Hallazgos clasificados como correcto, a revisar o requiere atención"),
                t("No se borra nada por ti; tú mantienes el control"),
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                  <span style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>{line}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <a
                href="https://x.backupreader.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="br-btn br-btn-primary br-btn-lg"
              >
                {t("Conectar X")}
              </a>
              <a href="#features" style={{ fontSize: 14.5, color: "var(--brass-600)", textDecoration: "none" }}>{t("Cómo funciona el análisis")}</a>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img src="/redesign/x-icon.svg" alt="Backup Reader X" style={{ width: "100%", maxWidth: 420, height: "auto" }} />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: "var(--ink-950)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(56px,8vw,96px) clamp(16px,4vw,24px)", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: "clamp(30px,4.2vw,42px)", lineHeight: 1.14, letterSpacing: "-0.02em", color: "var(--paper-50)" }}>
            {t("Backup de tus recuerdos")}
          </h2>
          <p style={{ margin: "18px auto 30px", fontSize: 17, lineHeight: 1.6, color: "var(--ink-100)", maxWidth: "44ch" }}>
            {t("Crea una cuenta y empieza a respaldar tus chats de forma segura.")}
          </p>
          <button className="br-btn br-btn-primary br-btn-lg" onClick={goAuth}>{t("Comienza ahora")}</button>
        </div>
      </section>

      {/* El footer (con logo) lo añade el Layout en rutas de marketing */}
    </div>
  );
};