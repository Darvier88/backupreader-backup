import { FC, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { LangToggle, Logo } from "./BrandChrome";

/**
 * El menú de la cabecera sin sesión, a pantalla completa (10c).
 *
 * POR QUÉ NO ES UN DESPLEGABLE
 * ----------------------------
 * En la cabecera de escritorio hay sitio para cuatro enlaces, el idioma y el
 * botón de empezar. En un móvil de 360 px eso se partía en dos filas y dejaba
 * una cabecera de 120 px pegada arriba, tapando justo la frase que tiene que
 * convencer a quien acaba de llegar.
 *
 * A pantalla completa caben las filas de 60 px que se tocan sin apuntar, y el
 * idioma puede tener su propia etiqueta en vez de ser dos letras sueltas al
 * lado de unos enlaces.
 *
 * LAS ACCIONES, ABAJO
 * -------------------
 * «Comienza ahora» y «Ya tengo cuenta» van al fondo, no arriba con los
 * enlaces. Arriba hay que estirar el pulgar; abajo está donde descansa. Y
 * separarlas de la navegación dice lo que son: lo que se viene a hacer, no un
 * sitio al que ir.
 */

export const MenuMovil: FC<{ abierto: boolean; onCerrar: () => void }> = ({
  abierto,
  onCerrar,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  /* Con el menú abierto, la página de detrás no se desplaza. Sin esto, el
     dedo que arrastra sobre el menú mueve el fondo, y al cerrarlo el usuario
     se encuentra en otro sitio de la página sin haberlo pedido. */
  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [abierto]);

  /* Escape cierra. Es lo que espera cualquiera que llegue con un teclado
     físico, y cuesta tres líneas. */
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const ir = (destino: string) => {
    onCerrar();
    if (destino.startsWith("/#")) {
      /* Un ancla de la portada: si ya se está en ella, `push` no desplaza a
         ningún sitio, así que se mueve a mano. */
      if (router.pathname === "/") {
        document.querySelector(destino.slice(1))?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    router.push(destino);
  };

  const fila = (texto: string, destino: string) => (
    <button
      key={texto}
      type="button"
      onClick={() => ir(destino)}
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: 0,
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-serif)",
        fontWeight: 500,
        fontSize: 22,
        color: "var(--ink-900)",
      }}
    >
      {texto}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--slate-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={(t("Menú") as string) || "Menú"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "var(--paper-50)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div style={{ height: 60, display: "flex", alignItems: "center", padding: "0 8px 0 20px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <Logo compact onClick={() => ir("/")} />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          aria-label={(t("Cerrar") as string) || "Cerrar"}
          onClick={onCerrar}
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
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 20px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {fila(t("Características") as string, "/#features")}
          {fila("FAQ", "/#faq")}
          {fila(t("Tutorial") as string, "/help")}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--slate-500)",
            }}
          >
            {t("Idioma")}
          </span>
          <LangToggle />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            className="br-btn br-btn-primary br-btn-lg br-btn-block"
            onClick={() => ir("/auth")}
          >
            {t("Comienza ahora")}
          </button>
          <button
            type="button"
            className="br-btn br-btn-lg br-btn-block"
            onClick={() => ir("/login")}
            /* Enlace de texto, no botón con borde (10c): la acción principal
               es una sola. */
            style={{ background: "transparent", border: "1px solid transparent", color: "var(--ink-800)" }}
          >
            {t("Ya tengo cuenta · Entrar")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuMovil;
