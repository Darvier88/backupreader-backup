import { FC, useMemo, useState } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import { fechaCorta, numero } from "../../lib/analisis/formatear";
import { Detalle, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * Cuál de las personas del chat eres tú.
 *
 * POR QUÉ SE PREGUNTA ANTES Y NO DESPUÉS
 * --------------------------------------
 * Sin esto, todas las tarjetas hablan en tercera persona de alguien que
 * eres tú: «Ana escribe más», «Ana responde antes». Se entiende, pero se
 * lee como un informe sobre dos desconocidos. El nombre propio es lo que
 * convierte la cifra en algo tuyo.
 *
 * CON EL ÚLTIMO MENSAJE DE CADA UNO
 * ---------------------------------
 * Un chat exportado puede traer nombres que no reconoces: un apodo, un
 * número de teléfono, el nombre que esa persona tenía guardado hace años.
 * Dos nombres sueltos no se distinguen; dos nombres con su último mensaje
 * se reconocen al instante.
 *
 * El texto sale de los mensajes que ya están descifrados en memoria, no del
 * análisis guardado: ahí dentro no hay ni una palabra del chat.
 */
export const PreguntaQuienEres: FC<{
  analisis: Analisis;
  /** Las filas del chat, para sacar el último mensaje de cada persona. */
  filas: string[][];
  /** Preseleccionado si se pudo deducir del título del chat. */
  sugerido?: string;
  onElegir: (autor: string | undefined) => void;
}> = ({ analisis, filas, sugerido, onElegir }) => {
  const idioma = i18n.language || "es";
  const [elegido, setElegido] = useState<string | undefined>(sugerido);

  /** El último mensaje con texto de cada persona, recorriendo hacia atrás. */
  const ultimos = useMemo(() => {
    const salida = new Map<string, { texto: string; fecha: string }>();
    for (let i = filas.length - 1; i >= 0; i--) {
      const autor = (filas[i]?.[1] || "").trim();
      const texto = (filas[i]?.[2] || "").trim();
      if (!autor || !texto || salida.has(autor)) continue;
      salida.set(autor, { texto, fecha: filas[i][0] || "" });
      if (salida.size >= analisis.autores.length) break;
    }
    return salida;
  }, [filas, analisis.autores.length]);

  /* Ordenadas por mensajes, como pide el diseño para los grupos: quien más
     escribe es quien antes se reconoce. */
  const gente = useMemo(
    () =>
      [...analisis.volumen.porAutor]
        .sort((a, b) => b.mensajes - a.mensajes)
        .map((a) => ({ ...a, ultimo: ultimos.get(a.autor) })),
    [analisis.volumen.porAutor, ultimos]
  );

  return (
    <div className="br-an">
      <Tarjeta titulo={enTexto(t("Antes de contar"))}>
        <Titular>
          {gente.length === 2
            ? t("¿Cuál de los dos eres tú?")
            : t("¿Cuál de estas personas eres tú?")}
        </Titular>
        <Detalle>
          {t("El archivo no lo dice. Nos hace falta para poner «tú» en cada cifra.")}
        </Detalle>

        <div className="br-an-opciones">
          {gente.map((a) => (
            <button
              key={a.autor}
              type="button"
              className={elegido === a.autor ? "br-an-opcion br-an-opcion--elegida" : "br-an-opcion"}
              aria-pressed={elegido === a.autor}
              onClick={() => setElegido(a.autor)}
            >
              <span className="br-an-opcion-punto" aria-hidden="true" />
              <span className="br-an-opcion-texto">
                <span className="br-an-opcion-fila">
                  <span className="br-an-opcion-titulo">{a.autor}</span>
                  <span className="br-an-opcion-ejemplo">
                    {/* «1 mensajes» delataba que nadie había mirado la
                        pantalla con un chat pequeño delante. */}
                    {a.mensajes === 1
                      ? t("1 mensaje")
                      : t("{{n}} mensajes", { n: numero(a.mensajes, idioma) })}
                  </span>
                </span>
                {a.ultimo && (
                  <span className="br-an-opcion-cita">«{recortar(a.ultimo.texto)}»</span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="br-an-botones">
          <button
            type="button"
            className="br-btn br-btn-primary br-btn-md"
            disabled={!elegido}
            onClick={() => onElegir(elegido)}
          >
            {t("Confirmar y calcular")}
          </button>
          {/* Hay chats donde ninguno eres tú: un grupo del que te
              exportaron el archivo, el chat de otra persona. */}
          <button type="button" className="br-btn br-btn-ghost br-btn-md" onClick={() => onElegir(undefined)}>
            {t("Ninguno")}
          </button>
        </div>
        <Detalle>{t("Puedes cambiarlo después en Ajustes.")}</Detalle>
      </Tarjeta>
    </div>
  );
};

/** El último mensaje, cortado para que quepa en una línea. */
function recortar(texto: string, tope = 70): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= tope ? limpio : `${limpio.slice(0, tope - 1)}…`;
}

export default PreguntaQuienEres;
