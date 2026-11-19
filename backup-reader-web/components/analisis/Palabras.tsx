import { FC } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import { numero } from "../../lib/analisis/formatear";
import { Barra, Detalle, EstoNoCuadra, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * Emojis, palabras, perdones y gracias.
 *
 * TODO LO QUE SE CUENTA SE PUEDE ABRIR
 * ------------------------------------
 * Cada emoji, cada palabra y cada «perdona» llevan un mensaje de ejemplo
 * detrás. Una cifra sobre la propia conversación es imposible de comprobar,
 * y poder tocar «47» y aterrizar en uno de esos 47 mensajes es lo que separa
 * un dato de una afirmación.
 *
 * El ejemplo es una POSICIÓN, no el texto: el análisis guardado no lleva nada
 * del chat dentro, y el mensaje se saca de la lista que ya está descifrada en
 * memoria.
 */

/**
 * El emoji listo para enseñar.
 *
 * Al contarlos se quita la variante de presentación (el U+FE0F invisible),
 * porque «❤» y «❤️» son el mismo emoji y el teclado decide cuál sale. Pero
 * al PINTARLO hay que devolvérsela: sin ella, «❤» se dibuja como un corazón
 * negro de texto en vez del rojo que la persona escribió. Añadirla a un
 * emoji que ya se dibuja como emoji no cambia nada.
 */
const paraVer = (emoji: string) =>
  [...emoji].length === 1 ? emoji + "️" : emoji;

export const Palabras: FC<{
  analisis: Analisis;
  yo?: string;
  marcadas: string[];
  onNoCuadra: (metrica: string) => void;
  /** Saltar al mensaje número `indice` del chat. */
  onIrAlMensaje?: (indice: number) => void;
}> = ({ analisis, yo, marcadas, onNoCuadra, onIrAlMensaje }) => {
  const idioma = i18n.language || "es";
  const { emojis, palabras, expresiones } = analisis;

  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);
  const accion = (metrica: string) => (
    <EstoNoCuadra metrica={metrica} marcada={marcadas.includes(metrica)} onMarcar={onNoCuadra} />
  );

  /** Una fila que se puede tocar para ir a un mensaje. */
  const Fila: FC<{ indice?: number; children: React.ReactNode }> = ({ indice, children }) => {
    const sePuede = typeof indice === "number" && !!onIrAlMensaje;
    return (
      <div
        role={sePuede ? "button" : undefined}
        tabIndex={sePuede ? 0 : undefined}
        onClick={sePuede ? () => onIrAlMensaje!(indice!) : undefined}
        onKeyDown={
          sePuede
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onIrAlMensaje!(indice!);
                }
              }
            : undefined
        }
        title={sePuede ? enTexto(t("Ver un mensaje donde aparece")) : undefined}
        className="br-an-fila"
      >
        {children}
      </div>
    );
  };

  const maxEmoji = Math.max(1, ...emojis.top.map((e) => e.total));
  const maxPalabra = Math.max(1, ...palabras.top.map((p) => p.total));

  return (
    <>
      <Tarjeta titulo={enTexto(t("Emojis"))} accion={accion("emojis")}>
        {emojis.total === 0 ? (
          <Detalle>{t("En este chat no se usan emojis.")}</Detalle>
        ) : (
          <>
            <Titular>
              {t("{{n}} emojis en todo el chat", { n: numero(emojis.total, idioma) })}
            </Titular>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {emojis.top.map((e) => (
                <Fila key={e.emoji} indice={e.ejemplo}>
                  <span style={{ fontSize: 20, width: 28 }}>{paraVer(e.emoji)}</span>
                  <div style={{ flex: 1 }}>
                    <Barra parte={e.total} total={maxEmoji} />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11.5,
                      color: "var(--slate-500)",
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {numero(e.total, idioma)}
                  </span>
                </Fila>
              ))}
            </div>
            <Detalle>
              {Object.entries(emojis.favoritoPorAutor)
                .map(([autor, emoji]) =>
                  yo && autor === yo
                    ? t("El tuyo: {{emoji}}", { emoji: paraVer(emoji) })
                    : t("El de {{quien}}: {{emoji}}", { quien: autor, emoji: paraVer(emoji) })
                )
                .join(" · ")}
            </Detalle>
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo={enTexto(t("Palabras"))} accion={accion("palabras")}>
        {palabras.top.length === 0 ? (
          <Detalle>{t("Aún no hay bastante texto para sacar palabras.")}</Detalle>
        ) : (
          <>
            <Titular>{t("De lo que más habláis")}</Titular>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {palabras.top.map((p) => (
                <Fila key={p.palabra} indice={p.ejemplo}>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13.5,
                      color: "var(--ink-900)",
                      width: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.palabra}
                  </span>
                  <div style={{ flex: 1 }}>
                    <Barra parte={p.total} total={maxPalabra} />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11.5,
                      color: "var(--slate-500)",
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {numero(p.total, idioma)}
                  </span>
                </Fila>
              ))}
            </div>
            {/* Decir qué se ha quitado evita la pregunta de por qué no sale
                «que», que en todos los chats es de las más frecuentes. */}
            <Detalle>
              {t(
                "Fuera las palabras que salen en cualquier conversación («que», «de», «vale») y las risas: sin ese filtro, la lista sería la misma en todos los chats."
              )}
            </Detalle>
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo={enTexto(t("Perdones y gracias"))}
        accion={accion("expresiones")}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Titular>
              {t("{{n}} veces se pide perdón", {
                n: numero(expresiones.totalDisculpas, idioma),
              })}
            </Titular>
            {expresiones.disculpas.map((d) => (
              <Fila key={d.autor} indice={d.ejemplos[0]}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, flex: 1 }}>
                  {comoSeLlama(d.autor)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--slate-500)",
                  }}
                >
                  {t("{{n}} · {{tasa}} de cada 100 mensajes", {
                    n: numero(d.total, idioma),
                    tasa: numero(d.porCienMensajes, idioma),
                  })}
                </span>
              </Fila>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Titular>
              {t("{{n}} veces se dan las gracias", {
                n: numero(expresiones.totalAgradecimientos, idioma),
              })}
            </Titular>
            {expresiones.agradecimientos.map((a) => (
              <Fila key={a.autor} indice={a.ejemplos[0]}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, flex: 1 }}>
                  {comoSeLlama(a.autor)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--slate-500)",
                  }}
                >
                  {t("{{n}} · {{tasa}} de cada 100 mensajes", {
                    n: numero(a.total, idioma),
                    tasa: numero(a.porCienMensajes, idioma),
                  })}
                </span>
              </Fila>
            ))}
          </div>
        </div>
        {/* Sin esto, un número grande se lee como un reproche. */}
        <Detalle>
          {t(
            "Contar no es juzgar: muchos «perdona» son «perdona, estaba en el metro», y eso no es disculparse por nada."
          )}
        </Detalle>
      </Tarjeta>
    </>
  );
};

export default Palabras;
