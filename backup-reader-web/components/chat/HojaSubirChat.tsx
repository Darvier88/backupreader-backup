import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Hoja para elegir de dónde sale el .zip (pantalla 2c).
 *
 * Sustituye a la fila «Subir desde: Google Drive · Archivos», que en un
 * teléfono se desbordaba: tres elementos en línea con una etiqueta en
 * versalitas no caben en 360px, y acababan partiéndose o saliéndose.
 *
 * Una hoja resuelve eso sin inventar nada: cada origen ocupa su propia fila de
 * 60px, que se toca sin apuntar, y el título explica qué se está eligiendo. La
 * misma hoja se abre desde el inicio y desde el panel, así que hay un solo
 * sitio donde está escrito de dónde se puede subir un chat.
 *
 * Sube desde abajo porque es donde está el pulgar, y porque deja ver detrás la
 * pantalla de la que salió: no es un cambio de sitio, es una pregunta.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const HojaSubirChat: FC<{
  abierta: boolean;
  onCerrar: () => void;
  onGoogleDrive: () => void;
  onArchivos: () => void;
  /** En Android el selector de archivos no sirve para los .zip de WhatsApp. */
  mostrarArchivos?: boolean;
}> = ({ abierta, onCerrar, onGoogleDrive, onArchivos, mostrarArchivos = true }) => {
  const { t } = useTranslation();

  /* Con la hoja abierta, el fondo no debe desplazarse: en un teléfono se
     siente como si la hoja se hubiera soltado de la pantalla. */
  useEffect(() => {
    if (!abierta) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alPulsar);
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  const fila = (etiqueta: string, descripcion: string, icono: JSX.Element, alPulsar: () => void) => (
    <button
      type="button"
      onClick={() => {
        /* Se cierra ANTES de lanzar la acción: abrir el selector de archivos
           con la hoja todavía encima deja los dos planos superpuestos. */
        onCerrar();
        alPulsar();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        minHeight: 60,
        padding: "0 18px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 9,
          background: "var(--paper-100)",
          color: "var(--brass-600)",
        }}
      >
        {icono}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-sans)",
            fontSize: 15.5,
            fontWeight: 600,
            color: "var(--ink-900)",
          }}
        >
          {etiqueta}
        </span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--slate-500)",
          }}
        >
          {descripcion}
        </span>
      </span>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={enTexto(t("Subir un chat"))}
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        /* Velo en tinta, no el gris del navegador, que enfría el papel. */
        background: "rgba(15,24,38,0.55)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface-raised)",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingBottom: "env(safe-area-inset-bottom, 12px)",
          boxShadow: "var(--shadow-lg, 0 -8px 40px rgba(15,24,38,0.18))",
        }}
      >
        {/* Asa: dice que esto se puede cerrar arrastrando o tocando fuera. */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: "var(--border)" }} />
        </div>

        <div style={{ padding: "10px 18px 16px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 21,
              color: "var(--ink-900)",
            }}
          >
            {t("Subir un chat")}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--slate-700)" }}>
            {t("Elige dónde está el .zip que exportaste.")}
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }}>
          {fila(
            enTexto(t("Google Drive")),
            enTexto(t("Si lo guardaste en tu Drive")),
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9 15H3l9-15z" />
            </svg>,
            onGoogleDrive
          )}

          {mostrarArchivos &&
            fila(
              enTexto(t("Archivos del teléfono")),
              enTexto(t("Si lo descargaste a este dispositivo")),
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h5l2 2h9v10H4V7z" />
              </svg>,
              onArchivos
            )}
        </div>

        <p
          style={{
            margin: 0,
            padding: "14px 18px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--slate-500)",
          }}
        >
          {t("Solo tú puedes ver tus chats")}
        </p>
      </div>
    </div>
  );
};

export default HojaSubirChat;
