import { FC } from "react";
import { useTranslation } from "react-i18next";

/**
 * La barra del chat cuando se llega desde una cifra del análisis (1g).
 *
 * DE DÓNDE SALE
 * -------------
 * En el análisis, tocar un emoji, una palabra o un «perdona» trae aquí. La
 * cifra sola no se puede comprobar: «47 corazones» es una afirmación hasta
 * que se ven los 47. Esto es lo que convierte el número en algo que se mira.
 *
 * POR QUÉ NO ES EL BUSCADOR
 * -------------------------
 * Podría ser el buscador con el texto ya puesto, pero entonces «disculpas»
 * habría que escribirlo como una palabra, y no lo es: son «perdón», «lo
 * siento» y «disculpa» a la vez. Por eso lleva varios términos dentro y
 * enseña arriba de qué va el filtro («Perdones»), que es lo que el usuario
 * tocó, en vez del texto que se está buscando de verdad.
 *
 * TAMPOCO ESCONDE MENSAJES
 * ------------------------
 * Igual que el buscador, marca y salta, pero deja la conversación entera. Un
 * «perdona» sin el mensaje de antes no cuenta nada, y es justo el contexto lo
 * que el usuario viene a ver.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const FiltroDelAnalisis: FC<{
  /** Lo que el usuario tocó: «❤️», «curro», «Perdones». */
  etiqueta: string;
  /** Cuántas coincidencias hay en todo el chat. */
  total: number;
  /** En cuál está, empezando en 0. */
  activa: number;
  onActiva: (indice: number) => void;
  /** Quitar el filtro y volver al chat normal. */
  onQuitar: () => void;
  /**
   * Ensanchar el filtro a todo el chat, si ahora mira a una sola persona.
   *
   * Va aquí y no en el panel porque la pregunta («¿y los demás?») nace
   * mirando estos resultados, no volviendo a la lista.
   */
  onTodos?: () => void;
}> = ({ etiqueta, total, activa, onActiva, onQuitar, onTodos }) => {
  const { t } = useTranslation();

  const saltar = (paso: number) => {
    if (total === 0) return;
    /* Da la vuelta, como el buscador: llegar a la última y encontrarse una
       flecha muerta obliga a subir a mano para repasar. */
    onActiva((activa + paso + total) % total);
  };

  const flecha = (paso: number, etiquetaFlecha: string, d: string) => (
    <button
      type="button"
      aria-label={etiquetaFlecha}
      disabled={total === 0}
      onClick={() => saltar(paso)}
      className="br-filtro-flecha"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </button>
  );

  return (
    /* El `role="status"` va en la cifra y no en la barra entera: una región
       viva con botones dentro hace que el lector de pantalla relea la barra
       completa —etiqueta, flechas y ✕— cada vez que cambia el número. */
    <div className="br-filtro">
      <span className="br-filtro-etiqueta" title={etiqueta}>
        {etiqueta}
      </span>

      <span className="br-filtro-cuenta" role="status" aria-live="polite">
        {total === 0
          ? t("Sin resultados")
          : enTexto(
              t("{{actual}} de {{total}} resultados", {
                actual: activa + 1,
                total,
              })
            )}
      </span>

      {onTodos && (
        <button type="button" className="br-filtro-todos" onClick={onTodos}>
          {t("Ver de todos")}
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {flecha(-1, enTexto(t("Resultado anterior")), "M18 15l-6-6-6 6")}
        {flecha(1, enTexto(t("Resultado siguiente")), "M6 9l6 6 6-6")}
      </div>

      <button
        type="button"
        aria-label={enTexto(t("Quitar el filtro"))}
        onClick={onQuitar}
        className="br-filtro-quitar"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default FiltroDelAnalisis;
