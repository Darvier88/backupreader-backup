import { FC, useState, useEffect, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { AuthContext, FirestoreContext } from "../../context";

/* ============================================================================
   BrandHeader / BrandFooter — cromo "Expediente" para las páginas de marketing
   (landing, ayuda, legales). Header sticky de papel + logo (check-circle +
   "BackupReader" serif) + navegación + toggle de idioma ES/EN.
   Se usa SOLO en rutas de marketing; las rutas de app mantienen su NavBar.
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

const Logo: FC<{ onClick?: () => void }> = ({ onClick }) => (
  <span onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brass-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12.3l2.6 2.6L16 9.5" />
    </svg>
    <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, letterSpacing: "-0.01em", color: "var(--ink-900)" }}>
      Backup<span style={{ color: "var(--ink-500)", fontWeight: 500 }}>Reader</span>
    </span>
  </span>
);

const LangToggle: FC = () => {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Antes de montar, render estable ("es") para que coincida servidor/cliente.
  const current = mounted && (i18n.language || "es").startsWith("en") ? "en" : "es";
  const set = (l: "es" | "en") => i18n.changeLanguage(l);
  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "4px 8px", borderRadius: 100, cursor: "pointer", border: "none",
    background: active ? "var(--ink-900)" : "transparent",
    color: active ? "var(--paper-50)" : "var(--slate-500)",
  });
  return (
    <span suppressHydrationWarning style={{ display: "inline-flex", alignItems: "center", gap: 2, border: "1px solid var(--border)", borderRadius: 100, padding: 2 }}>
      <button style={pill(current === "es")} onClick={() => set("es")}>ES</button>
      <button style={pill(current === "en")} onClick={() => set("en")}>EN</button>
    </span>
  );
};

export const BrandHeader: FC<{ minimal?: boolean; app?: boolean; wide?: boolean; narrow?: boolean }> = ({ minimal, app, wide, narrow }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { logOut } = useContext(AuthContext);
  const { clean } = useContext(FirestoreContext);
  const go = (href: string) => router.push(href);

  const onLogout = () => {
    logOut();
    setTimeout(() => clean(), 1000);
  };

  if (app) {
    if (wide) {
      // Dashboard: contenedor centrado a 1360, igual que su contenido.
      return (
        <header className="br-header">
          <div className="br-header-inner" style={{ maxWidth: 1360 }}>
            <Logo onClick={() => go("/")} />
            <nav style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2.2vw,24px)" }}>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Ayuda")}</span>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={onLogout}>{t("Cerrar sesión")}</span>
              <LangToggle />
            </nav>
          </div>
        </header>
      );
    }
    // Planes / Pago: espejo del contenido (logo sobre el formulario centrado).
    return (
      <header className="br-header">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "center" }}>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center" }}>
              <Logo onClick={() => go("/")} />
            </div>
          </div>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "clamp(14px,2.2vw,24px)" }}>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Ayuda")}</span>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={onLogout}>{t("Cerrar sesión")}</span>
              <LangToggle />
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (minimal) {
    return (
      <header className="br-header">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "center" }}>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center" }}>
              <Logo onClick={() => go("/")} />
            </div>
          </div>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "clamp(14px,2.2vw,24px)" }}>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/")}>{t("Volver al inicio")}</span>
              <LangToggle />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="br-header">
      <div className="br-header-inner" style={{ maxWidth: narrow ? 760 : "var(--page-max)" }}>
        <Logo onClick={() => go("/")} />
        <nav style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2.2vw,26px)", flexWrap: "wrap" }}>
          <a href="/#features" className="br-navlink">{t("Características")}</a>
          <a href="/#faq" className="br-navlink">FAQ</a>
          <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Tutorial")}</span>
          <LangToggle />
          <button className="br-btn br-btn-primary br-btn-sm" onClick={() => go("/auth")}>
            {t("Comienza ahora")}
          </button>
        </nav>
      </div>
    </header>
  );
};

export const BrandFooter: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <footer className="br-footer">
      <div className="br-footer-inner">
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, color: "var(--ink-900)" }}>
          Backup<span style={{ color: "var(--ink-500)", fontWeight: 500 }}>Reader</span>
        </span>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => router.push("/privacyPolicy")}>{t("Política de Privacidad")}</span>
          <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => router.push("/termsConditions")}>{t("Términos del Servicio")}</span>
        </div>
        <span className="br-footer-mark">Backup Reader, LLC</span>
      </div>
    </footer>
  );
};
