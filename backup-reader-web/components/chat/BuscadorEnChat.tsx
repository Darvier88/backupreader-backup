import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Buscar dentro del chat abierto (pantalla 1c).
 *
 * NO FILTRA: RESALTA Y SALTA
 * --------------------------
 * Antes, escribir en el buscador escondía los mensajes que no coincidían. El
 * problema es que una conversación se lee por el contexto: ver el mensaje que
 * dice "documentos" sin el que viene justo antes no cuenta la historia, y
 * perder ese hilo es lo que hace que el usuario borre la búsqueda para volver
 * a situarse.
 *
 * Ahora se queda todo en pantalla, se marcan las coincidencias y se salta
 * entre ellas con las flechas, como en el buscador de un navegador.
 *
 * Las flechas miden 44px porque es un control que se usa repetidamente con el
 * pulgar: una flecha pequeña obliga a apuntar, y aquí se pulsa muchas veces
 * seguidas para recorrer los resultados.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const BuscadorEnChat: FC<{
  consulta: string;
  onConsulta: (valor: string) => void;
  /** Cuántas coincidencias hay en todo el chat. */
  total: number;
  /** En cuál está el usuario, empezando en 0. */
  activa: number;
  onActiva: (indice: number) => void;
}> = ({ consulta, onConsulta, total, activa, onActiva }) => {
  const { t } = useTranslation();
  const [enfocado, setEnfocado] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const abierto = enfocado || consulta.length > 0;

  const saltar = (paso: number) => {
    if (total === 0) return;
    /* Da la vuelta en los extremos: al llegar a la última, la siguiente es la
       primera. Encontrarse con una flecha muerta al final de la lista obliga a
       volver arriba a mano para repasar. */
    onActiva((activa + paso + total) % total);
  };

  /* Al cambiar la consulta se vuelve a la primera coincidencia: dejar el
     contador donde estaba apuntaría a una coincidencia de la búsqueda
     anterior, que ya no existe. */
  useEffect(() => {
    onActiva(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);

  const cancelar = () => {
    onConsulta("");
    setEnfocado(false);
    campoRef.current?.blur();
  };

  const flecha = (paso: number, etiqueta: string, d: string) => (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={total === 0}
      onClick={() => saltar(paso)}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        cursor: total === 0 ? "default" : "pointer",
        opacity: total === 0 ? 0.3 : 1,
        color: "var(--ink-900)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <input
          ref={campoRef}
          value={consulta}
          onChange={(e) => onConsulta(e.target.value)}
          onFocus={() => setEnfocado(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelar();
            /* Enter salta a la siguiente, como en el buscador del navegador.
               Sin esto, Enter en un formulario puede enviar o no hacer nada. */
            if (e.key === "Enter") {
              e.preventDefault();
              saltar(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder={enTexto(t("Buscar en este chat"))}
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            color: "var(--ink-900)",
          }}
        />

        {abierto && (
          <button
            type="button"
            onClick={cancelar}
            style={{
              height: 44,
              padding: "0 4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--brass-600)",
              whiteSpace: "nowrap",
            }}
          >
            {t("Cancelar")}
          </button>
        )}
      </div>

      {consulta.trim().length >= 2 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--slate-500)",
            }}
          >
            {total === 0
              ? t("Sin resultados")
              : /* "2 de 3", no solo "3": al saltar hay que saber por dónde se
                   va, o no se sabe si ya se dio la vuelta entera. */
                enTexto(
                  t("{{actual}} de {{total}} resultados", {
                    actual: activa + 1,
                    total,
                  })
                )}
          </span>

          <div style={{ display: "flex", alignItems: "center" }}>
            {flecha(-1, enTexto(t("Resultado anterior")), "M18 15l-6-6-6 6")}
            {flecha(1, enTexto(t("Resultado siguiente")), "M6 9l6 6 6-6")}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuscadorEnChat;
