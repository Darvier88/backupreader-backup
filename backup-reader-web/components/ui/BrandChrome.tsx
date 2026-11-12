import { FC, useState, useEffect, useContext } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { AuthContext, FirestoreContext } from "../../context";
import { cambiarIdioma } from "../../i18n";
import { useMediaQuery } from "@mui/material";
import { MenuMovil } from "./MenuMovil";

/* ============================================================================
   BrandHeader / BrandFooter — cromo "Expediente" para las páginas de marketing
   (landing, ayuda, legales). Header sticky de papel + logo (check-circle +
   "BackupReader" serif) + navegación + toggle de idioma ES/EN.
   Se usa SOLO en rutas de marketing; las rutas de app mantienen su NavBar.
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

/* Exportados para que `NavBar` —la cabecera de las rutas de app en móvil— use
   exactamente el mismo logo y el mismo selector de idioma que esta, y no dos
   marcas distintas según el ancho de pantalla. */
export const Logo: FC<{ onClick?: () => void; compact?: boolean; oscuro?: boolean }> = ({
  onClick,
  compact,
  oscuro,
}) => {
  /* `compact` solo encoge; no cambia el dibujo ni los colores. Es para la
     cabecera de móvil, donde el logo a tamaño completo junto al resto de
     controles no cabe en una línea y parte la barra en dos filas. */
  const lado = compact ? 24 : 28;
  return (
    <span onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: compact ? 8 : 10, cursor: "pointer", flexShrink: 0 }}>
      <svg width={lado} height={lado} viewBox="0 0 24 24" fill="none" stroke={oscuro ? "var(--paper-50)" : "var(--brass-500)"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M8 12.3l2.6 2.6L16 9.5" />
      </svg>
      <span style={{ fontFamily: serif, fontWeight: 600, fontSize: compact ? 17 : 20, letterSpacing: "-0.01em", color: oscuro ? "var(--paper-50)" : "var(--ink-900)", whiteSpace: "nowrap" }}>
        {/* `oscuro`: sobre tinta (4c, 5a, 7c–7e, 8a), como en el diseño. */}
        Backup<span style={{ color: oscuro ? "rgba(199,210,223,0.7)" : "var(--ink-500)", fontWeight: 500 }}>Reader</span>
      </span>
    </span>
  );
};

export const LangToggle: FC = () => {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Antes de montar, render estable ("es") para que coincida servidor/cliente.
  const current = mounted && (i18n.language || "es").startsWith("en") ? "en" : "es";
  /* `cambiarIdioma` en vez de `i18n.changeLanguage` a secas: además de
     cambiarlo, lo guarda. Sin eso, al recargar la detección por navegador
     volvía a pisar la elección. */
  const set = (l: "es" | "en") => cambiarIdioma(l);
  /* El area pulsable sube a 40x40 sin agrandar el texto.
     Medía 31x22, y por debajo de unos 44px el dedo falla a menudo. Este boton
     ademas es el que pulsa quien no entiende lo que esta leyendo: alguien que
     ya esta perdido y al que, si falla, el toque le cambia de pagina en vez de
     cambiarle el idioma. Se agranda con padding, que es lo que cuenta para el
     dedo, y el tipo de 11px se queda igual. */
  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
    minWidth: 40, minHeight: 40,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "0 10px", borderRadius: 100, cursor: "pointer", border: "none",
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
  const phone = useMediaQuery("(max-width:720px)");
  const [menuAbierto, setMenuAbierto] = useState(false);
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
            <nav style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", rowGap: 4, gap: "clamp(10px,2.2vw,24px)", minWidth: 0 }}>
              {/* /account existía pero no se enlazaba desde ningún sitio, así
                  que el plan y la contraseña de cifrado no se podían tocar. */}
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/account")}>{t("Mi cuenta")}</span>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Ayuda")}</span>
              <span className="br-navlink" style={{ cursor: "pointer" }} onClick={onLogout}>{t("Cerrar sesión")}</span>
              <LangToggle />
            </nav>
          </div>
        </header>
      );
    }
    /* Planes / Pago: espejo del contenido (logo sobre el formulario centrado).

       EN ESCRITORIO, EN /plans NO SE PINTA (7c)
       -----------------------------------------
       Esa pantalla ya trae su propia columna en tinta con el logo, los tres
       pasos y «Ayuda · Salir». Con esta barra encima, el logo y los dos
       enlaces salían DOS veces a cuatro dedos de distancia, y el de arriba
       era el que no pertenecía a la pantalla.

       EN MÓVIL, UNA SOLA FILA (6a)
       ----------------------------
       La rejilla de dos columnas se partía en dos filas por debajo de 720 px:
       123 px de cabecera pegajosa tapando el título. `br-cabecera-app` la
       vuelve una fila de 60, con «Salir» en vez de «Cerrar sesión» porque es
       lo que cabe al lado de «Ayuda» sin volver a partirla.

       Y EN EL PAGO, SOLO EL LOGO (6b)
       -------------------------------
       El formulario ya lleva «Cambiar plan» para volver. A mitad de meter el
       número de la tarjeta, «Cerrar sesión» a un dedo del campo solo puede
       acabar mal, y el idioma se cambia antes de llegar aquí. */
    const esPlan = router.pathname === "/plans";
    const esPago = router.pathname === "/payment";
    return (
      <header className={esPlan ? "br-header br-cabecera-app br-solo-movil" : "br-header br-cabecera-app"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", alignItems: "center" }}>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center" }}>
              <Logo compact={phone} onClick={() => go("/")} />
            </div>
          </div>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "clamp(14px,2.2vw,24px)" }}>
              {!(phone && esPago) && (
                <>
                  <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Ayuda")}</span>
                  <span className="br-navlink" style={{ cursor: "pointer" }} onClick={onLogout}>{phone ? t("Salir") : t("Cerrar sesión")}</span>
                </>
              )}
              {!phone && <LangToggle />}
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (minimal) {
    /* La rejilla de dos columnas acompaña a las pantallas partidas de
       escritorio. En móvil no cabe y `auto-fit` la parte en DOS FILAS: el
       logo arriba y «Volver al inicio» con el idioma debajo. Eso dejaba una
       cabecera pegajosa de 123 px —casi una quinta parte de un iPhone— que
       además tapaba el título de la pantalla. `br-cabecera-minima` la vuelve
       una sola fila por debajo de 720 px. */
    return (
      <header className="br-header br-cabecera-minima">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", alignItems: "center" }}>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center" }}>
              <Logo onClick={() => go("/")} />
            </div>
          </div>
          <div style={{ padding: "12px clamp(16px, 4vw, 24px)" }}>
            <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "clamp(14px,2.2vw,24px)" }}>
              {/* «Volver al inicio» solo en escritorio: en móvil estas
                  pantallas ya tienen su flecha de atrás, y el logo de la
                  izquierda lleva al inicio igual. */}
              <span className="br-navlink br-solo-escritorio" style={{ cursor: "pointer" }} onClick={() => go("/")}>{t("Volver al inicio")}</span>
              <LangToggle />
            </div>
          </div>
        </div>
      </header>
    );
  }

  /* Cabecera sin sesión (10b).
     En escritorio, los cuatro enlaces de siempre. En móvil, una sola fila de
     60px —logo, «Comienza ahora» y el botón de menú—, y todo lo demás dentro
     del menú a pantalla completa (10c). Con los enlaces arriba, en 360px la
     cabecera se partía en dos filas y se comía la frase que tiene que
     convencer a quien acaba de llegar. */
  return (
    <>
      <header className="br-header">
        <div className="br-header-inner" style={{ maxWidth: narrow ? 760 : "var(--page-max)" }}>
          <Logo onClick={() => go("/")} compact={phone} />
          <nav style={{ display: "flex", alignItems: "center", gap: phone ? 8 : "clamp(14px,2.2vw,26px)", flexWrap: "nowrap" }}>
            {!phone && (
              <>
                <a href="/#features" className="br-navlink">{t("Características")}</a>
                <a href="/#faq" className="br-navlink">FAQ</a>
                <span className="br-navlink" style={{ cursor: "pointer" }} onClick={() => go("/help")}>{t("Tutorial")}</span>
                <LangToggle />
              </>
            )}
            <button className="br-btn br-btn-primary br-btn-sm br-cta-compacto" onClick={() => go("/auth")} style={{ whiteSpace: "nowrap" }}>
              {t("Comienza ahora")}
            </button>
            {phone && (
              <button
                type="button"
                aria-label={(t("Menú") as string) || "Menú"}
                aria-expanded={menuAbierto}
                onClick={() => setMenuAbierto(true)}
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-900)",
                  marginRight: -10,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
            )}
          </nav>
        </div>
      </header>

      <MenuMovil abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </>
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
