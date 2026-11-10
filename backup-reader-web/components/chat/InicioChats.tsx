import { FC } from "react";
import { useTranslation } from "react-i18next";

import { iniciales, nombreDelContacto, partirTitulo } from "../../lib/nombres-de-chat";

/**
 * La pantalla de inicio (2a con chats, 2b sin ninguno).
 *
 * Sustituye a la tarjeta «Ningún chat seleccionado», que describía un estado
 * en vez de ofrecer algo que hacer. Quien entra viene a leer sus chats o a
 * subir uno, y la pantalla ahora dice exactamente eso.
 *
 * UNA SOLA ACCIÓN PRINCIPAL, Y CAMBIA SEGÚN LO QUE HAY
 * ----------------------------------------------------
 * Con chats guardados, lo que casi siempre se quiere es leerlos: «Ver mis
 * chats» va en tinta y subir queda en segundo plano. Sin chats, «Ver mis
 * chats» desaparece del todo en vez de quedarse apagado: un botón desactivado
 * invita a pulsarlo para averiguar por qué no funciona, y aquí la respuesta
 * sería «porque todavía no has hecho lo otro», que es exactamente lo que el
 * otro botón ya dice.
 *
 * Sin chats se explica además cómo exportar desde WhatsApp. Es el único
 * momento en que esa instrucción hace falta, y es justo cuando el usuario no
 * puede avanzar sin ella.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

const mono = "var(--font-mono)";
const serif = "var(--font-serif)";

const etiqueta: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--slate-500)",
};

export type ChatReciente = {
  /** Handle del backup, lo que espera `getFile`. */
  fullPath: string;
  /** Título tal como lo guardó la exportación. */
  name: string;
};

export const InicioChats: FC<{
  chats: ChatReciente[];
  onVerMisChats: () => void;
  onSubir: () => void;
  onAbrirChat: (fullPath: string, nombre: string) => void;
  /** Cuántos recientes enseñar. Más de cuatro ya es la lista entera. */
  maxRecientes?: number;
}> = ({ chats, onVerMisChats, onSubir, onAbrirChat, maxRecientes = 4 }) => {
  const { t } = useTranslation();
  const hayChats = chats.length > 0;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        padding: "28px 18px 40px",
      }}
    >
      {hayChats ? (
        <>
          <span style={{ ...etiqueta, color: "var(--brass-600)" }}>
            {t("Tu respaldo")}
          </span>
          <h1
            style={{
              margin: "10px 0 8px",
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 30,
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              color: "var(--ink-900)",
            }}
          >
            {t("Tus chats, en un solo lugar.")}
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.6, color: "var(--slate-700)" }}>
            {t("Léelos con calma. Solo tú tienes acceso.")}
          </p>

          <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={onVerMisChats}>
            {t("Ver mis chats")}
          </button>

          <p style={{ ...etiqueta, margin: "14px 0 0", textAlign: "center" }}>
            {enTexto(
              t("{{total}} chats guardados", { total: chats.length })
            )}
          </p>
        </>
      ) : (
        <>
          <h1
            style={{
              margin: "0 0 10px",
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
              color: "var(--ink-900)",
            }}
          >
            {t("Aún no tienes chats guardados.")}
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 15.5, lineHeight: 1.6, color: "var(--slate-700)" }}>
            {/* La ruta exacta dentro de WhatsApp, no "exporta tu chat": el
                usuario que no sabe hacerlo es justo el que está aquí. */}
            {t("En WhatsApp, abre el chat → Más → Exportar chat. Luego súbelo aquí.")}
          </p>
        </>
      )}

      <div style={{ marginTop: hayChats ? 26 : 0 }}>
        <button
          className={
            hayChats
              ? "br-btn br-btn-ghost br-btn-md br-btn-block"
              : "br-btn br-btn-primary br-btn-lg br-btn-block"
          }
          onClick={onSubir}
        >
          {t("Subir un chat")}
        </button>
        <p style={{ ...etiqueta, margin: "10px 0 0", textAlign: "center" }}>
          {hayChats
            ? t("Archivo .zip exportado de WhatsApp")
            : t("Desde Google Drive o Archivos · .zip")}
        </p>
      </div>

      {hayChats && (
        <div style={{ marginTop: 30 }}>
          <span style={etiqueta}>{t("Recientes")}</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {chats.slice(0, maxRecientes).map((c) => {
              const nombre = nombreDelContacto(c.name) || c.name;
              return (
                <button
                  key={c.fullPath}
                  type="button"
                  onClick={() => onAbrirChat(c.fullPath, c.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    minHeight: 58,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface-raised)",
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
                      borderRadius: 999,
                      background: "var(--paper-100)",
                      border: "1px solid var(--border)",
                      fontFamily: mono,
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      color: "var(--brass-600)",
                    }}
                  >
                    {iniciales(c.name)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-sans)",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--ink-900)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {nombre}
                    </span>
                    {/* La fecha de guardado, no el nombre del archivo: el .zip
                        se llama igual en todos y no distingue una fila de otra. */}
                    <span
                      style={{
                        display: "block",
                        fontFamily: mono,
                        fontSize: 11,
                        color: "var(--slate-500)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {partirTitulo(c.name).fecha || t("Guardado")}
                    </span>
                  </span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InicioChats;
