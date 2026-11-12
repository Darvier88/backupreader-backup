import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { iniciales, nombreDelContacto } from "../../lib/nombres-de-chat";
import { useAtajoDeBusqueda } from "../../hooks/useAtajoDeBusqueda";
import { etiquetaApertura, ultimaApertura } from "../../lib/aperturas";

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
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const tituloAccion: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 15,
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
  /** Escritorio: más ancho y con zona para soltar el .zip (8b). */
  ancho?: boolean;
  /** Lo que se suelta encima de la zona de arrastre. */
  onSoltarArchivos?: (archivos: FileList) => void;
  /** Abre el paso de desbloqueo. Solo se usa si `bloqueada`. */
  onDesbloquear?: () => void;
}> = ({ chats, onVerMisChats, onSubir, onAbrirChat, consulta, onConsulta, resultados, maxRecientes = 4, reciénCreada = false, bloqueada = false, onDesbloquear, ancho = false, onSoltarArchivos }) => {
  const { t, i18n } = useTranslation();
  /* «⌘ K» en Mac, «Ctrl K» en el resto (8b). Tras montar, para que servidor
     y cliente pinten lo mismo. */
  const [atajo, setAtajo] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setAtajo("⌘ K");
  }, []);
  const hayChats = chats.length > 0;
  const [encima, setEncima] = useState(false);
  /* ⌘K trae el cursor aquí. El atajo ya existía cuando el buscador vivía en
     el panel lateral; se muda con él. */
  const campo = useRef<HTMLInputElement>(null);
  useAtajoDeBusqueda(campo);

  /* Al enfocar o escribir, el buscador toma la cabecera (3b/8c): se va el
     título y aparece «Cancelar» (móvil) o la pista ESC (escritorio). */
  const [enfocado, setEnfocado] = useState(false);
  const buscando = !bloqueada && (enfocado || consulta.length > 0);
  const salirDeBusqueda = () => {
    onConsulta("");
    setEnfocado(false);
    campo.current?.blur();
  };

  const lupa = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
  const candado = (tam: number) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
  /* Inicial en un cuadro: el primero de la lista en tinta, el resto en papel
     (3a/8b), igual que en el panel. */
  const tile = (texto: React.ReactNode, primero: boolean, lado = 36) => (
    <span
      aria-hidden
      style={{
        width: lado,
        height: lado,
        flexShrink: 0,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: serif,
        fontSize: 14,
        background: primero ? "var(--ink-900)" : "var(--paper-100)",
        border: primero ? "none" : "1px solid var(--border)",
        color: primero ? "var(--paper-50)" : bloqueada ? "var(--slate-500)" : "var(--ink-900)",
      }}
    >
      {texto}
    </span>
  );

  const recientes = chats
    .map((c, i) => ({ c, i, abierto: ultimaApertura(c.fullPath) }))
    .sort((a, b) => (b.abierto ?? -1) - (a.abierto ?? -1) || a.i - b.i);

  const cuandoAbierto = (abierto: number | null) => {
    if (!abierto) return t("Guardado");
    const cuando = etiquetaApertura(abierto, i18n.language || "es");
    return cuando === "hoy"
      ? t("Abierto hoy")
      : cuando === "ayer"
      ? t("Abierto ayer")
      : enTexto(t("Abierto {{fecha}}", { fecha: cuando }));
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: ancho ? (buscando ? 1040 : 688) : 520,
        margin: "0 auto",
        padding: ancho ? (buscando ? "24px 24px 56px" : "96px 24px 48px") : buscando ? "12px 16px 40px" : "24px 20px 40px",
        minHeight: ancho && !buscando ? "100vh" : undefined,
        display: "flex",
        flexDirection: "column",
      }}
      className="br-inicio-alto"
    >
      {/* Con la bóveda cerrada el aviso es la franja ocre de arriba (4d);
          aquí ya no se repite. */}

      {/* El buscador es lo primero cuando ya hay chats (3a/8b). */}
      {hayChats && (
        <div style={{ display: "flex", flexDirection: "column", gap: ancho ? 18 : 14 }}>
          {!buscando && !bloqueada && (
            <h2
              style={{
                margin: 0,
                fontFamily: serif,
                fontWeight: 500,
                fontSize: ancho ? 38 : 28,
                lineHeight: ancho ? 1.1 : 1.15,
                letterSpacing: ancho ? "-0.02em" : "-0.015em",
                color: "var(--ink-900)",
              }}
            >
              {t("¿Qué estás buscando?")}
            </h2>
          )}
          {/* Con la bóveda cerrada el buscador no puede buscar: el índice
              está cifrado con la misma clave que los chats. Se apaga en vez
              de contestar «sin resultados», que haría creer que esos
              mensajes no existen. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                flex: 1,
                minWidth: 0,
                height: ancho ? (buscando ? 48 : 56) : buscando ? 44 : 52,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: ancho ? "0 12px 0 18px" : "0 8px 0 16px",
                background: "#fff",
                border: `1.5px solid ${buscando ? "var(--brass-500)" : "var(--border)"}`,
                boxShadow: buscando ? "var(--focus-ring)" : ancho ? "0 2px 8px rgba(22,35,59,0.06)" : "0 1px 3px rgba(22,35,59,0.06)",
                borderRadius: buscando && !ancho ? 8 : 10,
                color: "var(--slate-400)",
                opacity: bloqueada ? 0.5 : 1,
                cursor: bloqueada ? "default" : "text",
              }}
            >
              {lupa}
              <input
                ref={campo}
                value={consulta}
                disabled={bloqueada}
                onFocus={() => setEnfocado(true)}
                onBlur={() => { if (!consulta) setEnfocado(false); }}
                onChange={(e) => onConsulta(e.target.value)}
                onKeyDown={(e) => {
                  /* Escape vacía el campo y lo suelta. */
                  if (e.key === "Escape") {
                    e.preventDefault();
                    salirDeBusqueda();
                  }
                }}
                placeholder={enTexto(
                  bloqueada
                    ? t("Personas o mensajes")
                    : ancho
                    ? t("Personas o mensajes en tus {{n}} chats", { n: chats.length })
                    : t("Personas o mensajes")
                )}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  padding: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  color: "var(--ink-900)",
                  cursor: "inherit",
                }}
              />
              {/* En el móvil, una ✕ para vaciar sin salir (3b). */}
              {!ancho && consulta && (
                <button
                  type="button"
                  aria-label={enTexto(t("Borrar búsqueda"))}
                  onClick={() => { onConsulta(""); campo.current?.focus(); }}
                  style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--slate-500)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
              {/* La pista del atajo dentro del campo (8b); al buscar, ESC (8c). */}
              {ancho && !bloqueada && (
                <kbd
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    padding: "3px 7px",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: "var(--paper-50)",
                    fontFamily: mono,
                    fontSize: 11,
                    color: "var(--slate-500)",
                  }}
                >
                  {buscando ? "ESC" : atajo}
                </kbd>
              )}
            </label>
            {!ancho && buscando && (
              <button
                type="button"
                onClick={salirDeBusqueda}
                style={{ height: 44, padding: "0 6px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink-800)", whiteSpace: "nowrap" }}
              >
                {t("Cancelar")}
              </button>
            )}
          </div>
          {!buscando && !bloqueada && !ancho && (
            <p style={{ ...etiqueta, margin: 0, fontSize: 11, letterSpacing: "0.08em" }}>
              {enTexto(t("Busca en tus {{total}} chats", { total: chats.length }))}
            </p>
          )}
          {resultados}
        </div>
      )}

      {/* Una sola tarjeta, a lo ancho (10a).
          «Ver mis chats» se fue a la cabecera, al botón «Conversaciones · N»:
          estaba aquí abajo, en una rejilla de dos, y duplicaba algo que ya se
          podía hacer desde arriba. Lo que queda es subir, que es la única
          acción de esta pantalla que no está en ningún otro sitio. */}
      {hayChats && !buscando && !bloqueada && !ancho && (
        <button
          type="button"
          onClick={onSubir}
          style={{ ...tarjetaAccion, width: "100%", marginTop: 24 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m17 8-5-5-5 5M12 3v12" />
          </svg>
          <span style={tituloAccion}>{t("Subir un chat")}</span>
        </button>
      )}

      {/* Recientes.
          Móvil: lista plana con el archivo en mono (3a). Con la bóveda cerrada
          se listan todos como «Chat cifrado · Bloqueado» (4d).
          Escritorio: dos tarjetas con cuándo se abrieron (8b). */}
      {hayChats && !buscando && (
        ancho && !bloqueada ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 40 }}>
            {recientes.slice(0, 2).map(({ c, abierto }, n) => {
              const nombre = nombreDelContacto(c.name) || c.name;
              return (
                <button
                  key={c.fullPath}
                  type="button"
                  onClick={() => onAbrirChat(c.fullPath, c.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", textAlign: "left", minWidth: 0 }}
                >
                  {tile(iniciales(c.name), n === 0, 38)}
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, textTransform: "uppercase", color: "var(--slate-500)" }}>{cuandoAbierto(abierto)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 24 }}>
            <span style={{ ...etiqueta, fontSize: 11, paddingBottom: 6 }}>
              {bloqueada ? enTexto(t("Tus chats · {{n}}", { n: chats.length })) : t("Recientes")}
            </span>
            {(bloqueada ? recientes : recientes.slice(0, maxRecientes)).map(({ c }, n, lista) => {
              const nombre = bloqueada ? t("Chat cifrado") : nombreDelContacto(c.name) || c.name;
              return (
                <button
                  key={c.fullPath}
                  type="button"
                  disabled={bloqueada}
                  onClick={() => { if (!bloqueada) onAbrirChat(c.fullPath, c.name); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: n < lista.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: bloqueada ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  {/* Candado en lugar de las iniciales con la bóveda cerrada:
                      el nombre vive dentro del manifiesto cifrado. */}
                  {tile(bloqueada ? candado(16) : iniciales(c.name), !bloqueada && n === 0)}
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: bloqueada ? "var(--slate-500)" : "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nombre}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: bloqueada ? "var(--slate-400)" : "var(--slate-500)", textTransform: bloqueada ? "uppercase" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {bloqueada ? t("Bloqueado") : c.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Soltar el .zip (8b), al pie. El botón sigue, porque no todo el
          mundo arrastra y sin él no habría forma de subir con el teclado. */}
      {ancho && hayChats && !buscando && !bloqueada && onSoltarArchivos && (
        <>
          <div style={{ flex: 1, minHeight: 40 }} />
          <div
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              if (e.dataTransfer?.files?.length) onSoltarArchivos(e.dataTransfer.files);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "16px 20px",
              borderRadius: 12,
              border: `1px ${encima ? "dashed var(--brass-500)" : "solid var(--border)"}`,
              background: "var(--paper-100)",
            }}
          >
            <img src="/redesign/upload-a-chat.svg" alt="" style={{ width: 92, height: "auto", flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>
                {encima ? t("Suelta el archivo para subirlo") : t("Sube otro chat")}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--slate-700)" }}>
                {t("Arrastra un .zip aquí o elige desde Google Drive o Archivos.")}
              </span>
            </div>
            <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={onSubir} style={{ flexShrink: 0 }}>
              {t("Subir")}
            </button>
          </div>
        </>
      )}

      {!hayChats && (
        /* La primera vez, el botón baja hasta el fondo de la pantalla (5c).
           Es la única acción que hay, y el pulgar llega antes abajo que en
           mitad de la pantalla; además separa las instrucciones de lo que
           hay que hacer después de leerlas. Lo hace `br-primera-vez`, que
           reparte el alto; en escritorio no aplica y queda seguido. */
        <div className="br-primera-vez">
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

          {/* Ilustración de subir y «Empieza aquí» (5c). La lámina dice lo
              que hay que hacer antes de leer nada; la etiqueta marca que esta
              es la única acción de la pantalla. */}
          {/* Más baja en móvil: con la lámina a 140px, las instrucciones y la
              acción no caben en una pantalla de 667px y el botón se iba por
              debajo del borde. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: ancho ? 140 : 108, borderRadius: 12, background: "var(--paper-100)", margin: "0 0 18px" }}>
            <img src="/redesign/upload-a-chat.svg" alt="" style={{ display: "block", width: ancho ? 160 : 128, height: "auto" }} />
          </div>
          <p style={{ ...etiqueta, color: "var(--brass-600)", margin: "0 0 8px" }}>
            {t("Empieza aquí")}
          </p>
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

          <ol style={{ listStyle: "none", margin: "0 0 24px", padding: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {[
              t("Abre el chat en WhatsApp."),
              t("Toca el nombre → Exportar chat → Adjuntar archivos."),
              t("Guárdalo en Archivos o Google Drive."),
            ].map((paso, i) => (
              <li
                key={i}
                style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "flex-start", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
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
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-900)", lineHeight: 1.45 }}>
                  {/* «Exportar chat» en negrita (5c): es el nombre de la opción
                      que hay que buscar en el menú de WhatsApp. */}
                  {(() => {
                    const texto = enTexto(paso);
                    const clave = enTexto(t("Exportar chat"));
                    const i = clave ? texto.indexOf(clave) : -1;
                    if (i < 0) return texto;
                    return (
                      <>
                        {texto.slice(0, i)}
                        <strong style={{ fontWeight: 600 }}>{clave}</strong>
                        {texto.slice(i + clave.length)}
                      </>
                    );
                  })()}
                </span>
              </li>
            ))}
          </ol>

          <div className="br-movil-abajo">
            <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={onSubir}>
              {t("Subir un chat")}
            </button>
            <p style={{ ...etiqueta, margin: "10px 0 0", textAlign: "center" }}>
              {t("Archivo .zip · Google Drive o Archivos")}
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default InicioChats;
