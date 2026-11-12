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
  /** Avisa cuando la búsqueda toma la cabecera (1c), para ocultar el resto. */
  onAbierto?: (abierto: boolean) => void;
}> = ({ consulta, onConsulta, total, activa, onActiva, onAbierto }) => {
  const { t } = useTranslation();
  const [enfocado, setEnfocado] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const abierto = enfocado || consulta.length > 0;
  useEffect(() => {
    onAbierto?.(abierto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  /* En el móvil la búsqueda toma la cabecera entera (1c): se esconde la
     barra del logo. Si no, al saltar a una coincidencia la barra fija tapa
     el propio campo de búsqueda. La regla CSS solo actúa por debajo de
     720px. */
  useEffect(() => {
    document.body.classList.toggle("br-buscando", abierto);
    return () => document.body.classList.remove("br-buscando");
  }, [abierto]);

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
        {/* Campo con lupa y, al escribir, una ✕ para vaciar (1a/1c). */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 6px 0 14px",
            background: "#fff",
            border: abierto ? "1.5px solid var(--brass-500)" : "1.5px solid var(--border)",
            boxShadow: abierto ? "var(--focus-ring)" : "none",
            borderRadius: 8,
            color: "var(--slate-400)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={campoRef}
            value={consulta}
            onChange={(e) => onConsulta(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelar();
              /* Enter salta a la siguiente, como en el buscador del navegador. */
              if (e.key === "Enter") {
                e.preventDefault();
                saltar(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder={enTexto(t("Buscar en este chat"))}
            style={{
              flex: 1,
              minWidth: 0,
              height: "100%",
              padding: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--ink-900)",
            }}
          />
          {consulta.length > 0 && (
            <button
              type="button"
              aria-label={enTexto(t("Borrar búsqueda"))}
              onClick={() => {
                onConsulta("");
                campoRef.current?.focus();
              }}
              style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--slate-500)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {abierto && (
          <button
            type="button"
            onClick={cancelar}
            style={{
              height: 44,
              padding: "0 6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink-800)",
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
            /* Franja plana bajo el buscador (1c), no una tarjeta: la línea
               de abajo la pone el área de mensajes. */
            height: 44,
            marginTop: 6,
            marginBottom: -6,
            padding: "0 0 0 2px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--slate-700)",
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

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {flecha(-1, enTexto(t("Resultado anterior")), "M18 15l-6-6-6 6")}
            {flecha(1, enTexto(t("Resultado siguiente")), "M6 9l6 6 6-6")}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuscadorEnChat;
