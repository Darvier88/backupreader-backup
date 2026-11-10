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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        marginBottom: 14,
        borderRadius: 8,
        background: "var(--paper-100)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--brass-400)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          color: "var(--slate-700)",
          minWidth: 0,
        }}
      >
        {t("Tus chats están bloqueados.")}
      </span>

      <button
        type="button"
        onClick={onDesbloquear}
        style={{
          flexShrink: 0,
          minHeight: 36,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid var(--ink-900)",
          background: "var(--ink-900)",
          color: "var(--paper-50)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {t("Desbloquear")}
      </button>
    </div>
  );
};

export default BarraBloqueada;
