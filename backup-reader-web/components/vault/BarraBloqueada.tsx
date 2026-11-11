import { FC } from "react";
import { useTranslation } from "react-i18next";

/**
 * Barra de una línea: los chats siguen bloqueados (pantalla 4d).
 *
 * Es lo que queda cuando alguien omite el paso de desbloqueo. Sustituye al
 * bloque grande con título y párrafo que había antes.
 *
 * POR QUÉ UNA LÍNEA Y NO UN BLOQUE
 * --------------------------------
 * El bloque explicaba bien el problema la primera vez y estorbaba todas las
 * demás. Quien omitió el paso ya leyó la explicación entera hace un momento y
 * decidió seguir: repetírsela entera ocupa el sitio de sus chats y no añade
 * nada. Una línea con el botón al lado dice lo mismo para quien lo necesita y
 * desaparece de la vista para quien no.
 *
 * El refuerzo de verdad no es este texto, son los chats con candado y el
 * buscador apagado que hay debajo: eso explica el porqué en el momento exacto
 * en que el usuario intenta usarlos.
 */
export const BarraBloqueada: FC<{ onDesbloquear: () => void }> = ({ onDesbloquear }) => {
  const { t } = useTranslation();

  /* Franja ocre a todo el ancho bajo la cabecera, con candado y botón con
     borde en tinta (4d). */
  return (
    <div
      role="status"
      style={{
        background: "var(--ochre-100)",
        borderBottom: "1px solid rgba(184,132,43,0.25)",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px clamp(12px, 4vw, 24px) 12px clamp(16px, 4vw, 24px)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ochre-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.4, color: "var(--ink-900)" }}>
          {t("Tus chats están bloqueados.")}
        </span>
        <button
          type="button"
          onClick={onDesbloquear}
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            borderRadius: "var(--radius-md, 8px)",
            border: "1.5px solid var(--ink-900)",
            background: "transparent",
            color: "var(--ink-900)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {t("Desbloquear")}
        </button>
      </div>
    </div>
  );
};

export default BarraBloqueada;
