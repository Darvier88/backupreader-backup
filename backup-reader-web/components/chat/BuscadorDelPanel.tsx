import { FC, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * «Buscar en todos los chats», encima de la lista del panel (escritorio y
 * móvil), como en WhatsApp: mientras hay texto, la lista de chats se cambia
 * por los contactos que coinciden y los mensajes que contienen la palabra
 * (ResultadosGlobales); al borrar, vuelve la lista.
 *
 * Vivía aquí hasta la ronda 8, que lo llevó al centro del inicio. Volvió
 * porque desde un chat abierto no había forma de buscar en los demás sin
 * cerrarlo.
 *
 * El estado (`consulta`) es del panel que lo usa: así cada panel recuerda lo
 * que se buscó aunque se abra un chat desde los resultados.
 */
export const BuscadorDelPanel: FC<{
  consulta: string;
  onConsulta: (valor: string) => void;
  /** Bóveda cerrada: no hay índice que leer, así que el campo se apaga. */
  bloqueado?: boolean;
  style?: React.CSSProperties;
}> = ({ consulta, onConsulta, bloqueado = false, style }) => {
  const { t } = useTranslation();
  const campo = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: "relative", ...style }}>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)", pointerEvents: "none" }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        ref={campo}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        className="br-input"
        value={consulta}
        disabled={bloqueado}
        onChange={(e) => onConsulta(e.target.value)}
        onKeyDown={(e) => {
          /* Escape borra lo escrito: dejar el texto y soltar el campo dejaría
             los resultados tapando la lista, que es lo contrario de lo que
             se pide con Escape. */
          if (e.key === "Escape" && consulta) {
            e.preventDefault();
            onConsulta("");
          }
        }}
        placeholder={
          (bloqueado
            ? t("Desbloquea tus chats para buscar")
            : t("Buscar en todos los chats")) as string
        }
        aria-label={t("Buscar en todos los chats") as string}
        style={{
          width: "100%",
          height: 40,
          padding: "0 36px 0 36px",
          fontSize: 14,
          opacity: bloqueado ? 0.55 : 1,
          WebkitAppearance: "none",
        }}
      />
      {consulta && (
        <button
          type="button"
          aria-label={t("Borrar búsqueda") as string}
          onClick={() => {
            onConsulta("");
            campo.current?.focus();
          }}
          style={{
            position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: "var(--slate-500)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
