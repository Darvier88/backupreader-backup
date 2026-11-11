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

const tarjetaAccion: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  minHeight: 64,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  cursor: "pointer",
  textAlign: "left",
};

const tituloAccion: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--ink-900)",
};

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
  /** Lo que hay escrito en el buscador general. */
  consulta: string;
  onConsulta: (valor: string) => void;
  /** Los resultados, que los pinta quien llama. */
  resultados?: React.ReactNode;
  /** Cuántos recientes enseñar. Más de cuatro ya es la lista entera. */
  maxRecientes?: number;
  /** Si la clave de cifrado se acaba de crear, para saludarlo (5c). */
  reciénCreada?: boolean;
  /** La bóveda está cerrada: los chats existen pero no se pueden leer (4d). */
  bloqueada?: boolean;
  /** Abre el paso de desbloqueo. Solo se usa si `bloqueada`. */
  onDesbloquear?: () => void;
}> = ({ chats, onVerMisChats, onSubir, onAbrirChat, consulta, onConsulta, resultados, maxRecientes = 4, reciénCreada = false, bloqueada = false, onDesbloquear }) => {
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
      {/* Bóveda cerrada (4d).
          Se dice arriba y una sola vez, en vez de repetir un candado en cada
          sitio donde algo no funciona. Lo importante es que el usuario sepa
          que sus chats SIGUEN AHÍ: sin esta frase, una lista con candados se
          lee como «se han perdido». */}
      {bloqueada && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            marginBottom: 20,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--paper-100)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ flex: 1, minWidth: 140, fontSize: 14, lineHeight: 1.5, color: "var(--slate-700)" }}>
            {t("Tus chats están aquí, cerrados. Escribe tu contraseña de cifrado para leerlos.")}
          </span>
          {onDesbloquear && (
            <button type="button" className="br-btn br-btn-primary br-btn-sm" onClick={onDesbloquear}>
              {t("Desbloquear")}
            </button>
          )}
        </div>
      )}

      {/* El buscador es lo primero cuando ya hay chats (3a): con dos o tres
          respaldos se entra a leer, pero en cuanto hay unos cuantos lo que se
          quiere es encontrar algo concreto, y tenerlo que buscar entre las
          acciones es lo que hace que nadie lo use. */}
      {hayChats && (
        <div style={{ marginBottom: 24 }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 22,
              color: "var(--ink-900)",
            }}
          >
            {t("¿Qué estás buscando?")}
          </h2>
          {/* Con la bóveda cerrada el buscador no puede buscar: el índice
              está cifrado con la misma clave que los chats. Se desactiva en
              vez de dejarlo escribir y contestar «sin resultados», que haría
              creer que esos mensajes no existen. */}
          <input
            value={consulta}
            disabled={bloqueada}
            onChange={(e) => onConsulta(e.target.value)}
            placeholder={enTexto(
              bloqueada ? t("Desbloquea para buscar") : t("Personas o mensajes")
            )}
            style={{
              cursor: bloqueada ? "default" : "text",
              opacity: bloqueada ? 0.55 : 1,
              width: "100%",
              height: 46,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--ink-900)",
            }}
          />
          <p style={{ ...etiqueta, marginTop: 8 }}>
            {bloqueada
              ? t("Bloqueado")
              : enTexto(t("Busca en tus {{total}} chats", { total: chats.length }))}
          </p>
          {resultados}
        </div>
      )}

      {/* La ronda 3 sustituye al bloque grande de la 2a por dos tarjetas
          compactas: con el buscador arriba, un titular de dos lineas y un
          boton a todo ancho empujan los recientes fuera de la pantalla, y los
          recientes son lo que de verdad se pulsa. */}
      {hayChats && !consulta.trim() && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onVerMisChats} style={tarjetaAccion}>
            <span style={tituloAccion}>{t("Ver mis chats")}</span>
            <span style={{ ...etiqueta, marginTop: 4 }}>
              {enTexto(t("{{total}} guardados", { total: chats.length }))}
            </span>
          </button>
          <button onClick={onSubir} style={tarjetaAccion}>
            <span style={tituloAccion}>{t("Subir un chat")}</span>
            <span style={{ ...etiqueta, marginTop: 4 }}>{t("Archivo .zip")}</span>
          </button>
        </div>
      )}

      {!hayChats && (
        <div>
          {/* Pantallas 2b y 5c: la primera vez no basta con un boton.
              Quien acaba de crear la cuenta no tiene ningun chat porque
              todavia no sabe como sacarlo de WhatsApp, no porque no quiera.
              Un boton de "Subir un chat" a secas le pide un archivo que no
              tiene y no le dice donde conseguirlo: se queda mirando la
              pantalla sin nada que hacer. Las tres instrucciones son el paso
              que falta. */}
          {reciénCreada && (
            <p
              style={{
                ...etiqueta,
                color: "var(--brass-600)",
                margin: "0 0 14px",
              }}
            >
              {t("Tu clave está lista. Ya puedes subir chats.")}
            </p>
          )}

          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 500,
              color: "var(--ink-900)",
              margin: "0 0 6px",
            }}
          >
            {t("Sube tu primer chat")}
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--slate-700)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            {t("Primero expórtalo desde WhatsApp. Toma menos de un minuto.")}
          </p>

          <ol style={{ listStyle: "none", margin: "0 0 24px", padding: 0 }}>
            {[
              t("Abre el chat en WhatsApp."),
              t("Toca el nombre → Exportar chat → Adjuntar archivos."),
              t("Guárdalo en Archivos o Google Drive."),
            ].map((paso, i) => (
              <li
                key={i}
                style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--brass-600)",
                    paddingTop: 2,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--slate-700)", lineHeight: 1.45 }}>
                  {paso}
                </span>
              </li>
            ))}
          </ol>

          <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={onSubir}>
            {t("Subir un chat")}
          </button>
          <p style={{ ...etiqueta, margin: "10px 0 0", textAlign: "center" }}>
            {t("Archivo .zip · Google Drive o Archivos")}
          </p>
        </div>
      )}

      {hayChats && !consulta.trim() && (
        <div style={{ marginTop: 30 }}>
          <span style={etiqueta}>{t("Recientes")}</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {chats.slice(0, maxRecientes).map((c) => {
              const nombre = nombreDelContacto(c.name) || c.name;
              return (
                <button
                  key={c.fullPath}
                  type="button"
                  disabled={bloqueada}
                  onClick={() => { if (!bloqueada) onAbrirChat(c.fullPath, c.name); }}
                  style={{
                    opacity: bloqueada ? 0.6 : 1,
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
                    {bloqueada ? (
                      /* Candado en lugar de las iniciales: con la bóveda
                         cerrada el nombre del contacto vive dentro del
                         manifiesto cifrado, así que unas iniciales aquí
                         serían inventadas. */
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      iniciales(c.name)
                    )}
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
