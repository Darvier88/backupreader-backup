import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext, type FragmentoMensaje } from "../../context/StorageContext";
import { usePanelChats } from "../../context/PanelChatsContext";
import { avisoDeBusqueda } from "../../lib/busqueda/indexador";
import type { ResultadoEnChat } from "../../lib/busqueda/indice";
import { fragmentoAlrededor } from "../../lib/busqueda/resaltar";
import { handleDeBackup } from "../../lib/backupreader-crypto";
import { iniciales, nombreDelContacto } from "../../lib/nombres-de-chat";
import { TextoResaltado } from "./TextoResaltado";

/**
 * Resultados de buscar en TODOS los chats (pantalla 3b).
 *
 * Antes esto era una lista de chats con un recuento: «Mamá · 12 mensajes».
 * Eso dice dónde mirar, pero obliga a entrar en cada chat para descubrir si
 * era lo que se buscaba, y a volver atrás cuando no lo era. Ahora se enseña
 * el mensaje: con el fragmento delante se decide sin entrar.
 *
 * DE DÓNDE SALE EL TEXTO
 * ----------------------
 * El índice guarda qué palabras hay y en qué número de mensaje, no el texto.
 * Para el fragmento hay que descifrar el chat, así que solo se hace con los
 * que de verdad coinciden —dos o tres en una búsqueda normal, no los
 * cuarenta— y después de que el índice haya dicho cuáles son. El recuento y
 * los nombres aparecen enseguida; los fragmentos llegan un momento después.
 *
 * SIEMPRE SE DICE SI FALTAN CHATS POR INDEXAR
 * -------------------------------------------
 * Una búsqueda incompleta que se presenta como completa hace creer que el
 * mensaje no existe, y eso no se detecta nunca. Una que avisa de que le
 * faltan tres chats, sí.
 */

const RETARDO_MS = 250;
/** Cuántos mensajes se enseñan por chat antes de «Ver N más». */
const POR_CHAT = 2;

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

const mono = "var(--font-mono)";

const etiqueta: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--slate-500)",
  margin: 0,
};

type Filtro = "todo" | "personas" | "mensajes";

export const ResultadosGlobales = ({
  consulta,
  alAbrirChat,
}: {
  consulta: string;
  alAbrirChat: (handle: string, nombre: string) => void;
}) => {
  const { t } = useTranslation();
  const { buscarEnTodos, fragmentosDeChat, estadoIndexado } = useContext(StorageContext);
  const { irAMensaje } = usePanelChats();

  const [resultados, setResultados] = useState<ResultadoEnChat[]>([]);
  const [sinIndexar, setSinIndexar] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todo");
  /** backupId -> mensajes ya descifrados de ese chat. */
  const [fragmentos, setFragmentos] = useState<Record<string, FragmentoMensaje[]>>({});
  /** Chats cuyos resultados se han desplegado con «Ver N más». */
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const texto = consulta.trim();
    if (texto.length < 2) {
      setResultados([]);
      setSinIndexar(0);
      setFragmentos({});
      return;
    }

    let vigente = true;
    setBuscando(true);
    const temporizador = setTimeout(async () => {
      try {
        const r = await buscarEnTodos(texto);
        if (!vigente || r.consulta !== texto) return;

        setResultados(r.resultados);
        setSinIndexar(r.sinIndexar);
        setDesplegados({});
        setFragmentos({});
        setBuscando(false);

        /* Los fragmentos se piden DESPUÉS de pintar los recuentos. Descifrar
           tarda, y esperar a tenerlo todo dejaría la pantalla en blanco
           mientras ya se sabe en qué chats hay algo. */
        for (const res of r.resultados) {
          if (!vigente) return;
          const quiero = res.mensajes.slice(0, 10);
          if (quiero.length === 0) continue;
          const trozos = await fragmentosDeChat(res.backupId, quiero);
          if (!vigente) return;
          setFragmentos((prev) => ({ ...prev, [res.backupId]: trozos }));
        }
      } catch (error) {
        console.error("Falló la búsqueda global:", error);
        if (vigente) setBuscando(false);
      }
    }, RETARDO_MS);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);

  const aviso = avisoDeBusqueda(estadoIndexado);
  const hayQueAvisar = aviso.clave !== "completa" || sinIndexar > 0;

  if (consulta.trim().length < 2) return null;

  const conPersonas = resultados.filter((r) => r.contactos.length > 0);
  const conMensajes = resultados.filter((r) => r.total > 0);
  const nPersonas = conPersonas.reduce((n, r) => n + r.contactos.length, 0);
  const nMensajes = conMensajes.reduce((n, r) => n + r.total, 0);

  const abrirEnMensaje = (res: ResultadoEnChat, numero: number) => {
    irAMensaje({ consulta: consulta.trim(), mensaje: numero });
    alAbrirChat(handleDeBackup(res.backupId), res.nombre);
  };

  const avatar = (nombre: string) => (
    <span
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: "var(--paper-100)",
        border: "1px solid var(--border)",
        fontFamily: mono,
        fontSize: 11.5,
        color: "var(--brass-600)",
      }}
    >
      {iniciales(nombre)}
    </span>
  );

  const botonFiltro = (valor: Filtro, texto: string) => {
    const activo = filtro === valor;
    return (
      <button
        key={valor}
        type="button"
        onClick={() => setFiltro(valor)}
        style={{
          minHeight: 32,
          padding: "0 12px",
          borderRadius: 999,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: `1px solid ${activo ? "var(--ink-900)" : "var(--border)"}`,
          background: activo ? "var(--ink-900)" : "transparent",
          color: activo ? "var(--paper-50)" : "var(--slate-700)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: activo ? 600 : 500,
        }}
      >
        {texto}
      </button>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      {hayQueAvisar && (
        <p style={{ ...etiqueta, color: "var(--brass-600)", marginBottom: 10 }}>
          {aviso.clave === "indexando"
            ? enTexto(
                t("Preparando la búsqueda: faltan {{faltan}} de {{total}} chats.", {
                  faltan: aviso.faltan,
                  total: aviso.total,
                })
              )
            : enTexto(
                t("Esta búsqueda no cubre {{faltan}} chat(s) todavía.", {
                  faltan: aviso.clave === "faltan-chats" ? aviso.faltan : sinIndexar,
                })
              )}
        </p>
      )}

      {buscando && resultados.length === 0 && (
        <p style={etiqueta}>{enTexto(t("Buscando…"))}</p>
      )}

      {!buscando && resultados.length === 0 && !hayQueAvisar && (
        <p style={etiqueta}>{enTexto(t("Sin coincidencias en otros chats."))}</p>
      )}

      {resultados.length > 0 && (
        <>
          {/* Filtros con su recuento: dicen cuánto hay de cada cosa antes de
              pulsar, así que también sirven de resumen. */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {botonFiltro("todo", enTexto(t("Todo")))}
            {nPersonas > 0 &&
              botonFiltro(
                "personas",
                enTexto(t("Personas · {{n}}", { n: nPersonas }))
              )}
            {nMensajes > 0 &&
              botonFiltro(
                "mensajes",
                enTexto(t("Mensajes · {{n}}", { n: nMensajes }))
              )}
          </div>

          {(filtro === "todo" || filtro === "personas") && nPersonas > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={etiqueta}>{enTexto(t("Personas"))}</p>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {conPersonas.map((res) =>
                  res.contactos.map((persona) => (
                    <button
                      key={`${res.backupId}-${persona}`}
                      type="button"
                      onClick={() => alAbrirChat(handleDeBackup(res.backupId), res.nombre)}
                      style={filaBase}
                    >
                      {avatar(persona)}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={nombreFila}>
                          <TextoResaltado texto={persona} consulta={consulta} />
                        </span>
                        <span style={{ ...etiqueta, display: "block", marginTop: 2 }}>
                          {enTexto(t("Abrir chat"))}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {(filtro === "todo" || filtro === "mensajes") && nMensajes > 0 && (
            <div>
              <p style={etiqueta}>{enTexto(t("Mensajes"))}</p>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 14 }}>
                {conMensajes.map((res) => {
                  const trozos = fragmentos[res.backupId];
                  const todos = desplegados[res.backupId];
                  const aEnsenar = trozos ? (todos ? trozos : trozos.slice(0, POR_CHAT)) : [];
                  const restantes = (trozos?.length ?? 0) - aEnsenar.length;

                  return (
                    <div key={res.backupId}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        {avatar(res.nombre)}
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={nombreFila}>
                            {nombreDelContacto(res.nombre) || res.nombre}
                          </span>
                          <span style={{ ...etiqueta, display: "block" }}>
                            {res.aproximado
                              ? enTexto(t("Más de {{total}} coincidencias", { total: res.total }))
                              : enTexto(t("{{total}} coincidencias", { total: res.total }))}
                          </span>
                        </span>
                      </div>

                      {/* Mientras se descifra ese chat, su hueco dice que
                          está en camino en vez de parecer que no hay nada. */}
                      {!trozos && (
                        <p style={{ ...etiqueta, paddingLeft: 44 }}>
                          {enTexto(t("Abriendo…"))}
                        </p>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 44 }}>
                        {aEnsenar.map((f) => (
                          <button
                            key={f.mensaje}
                            type="button"
                            onClick={() => abrirEnMensaje(res, f.mensaje)}
                            style={{ ...filaBase, alignItems: "flex-start", padding: "10px 12px" }}
                          >
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  display: "block",
                                  fontFamily: "var(--font-sans)",
                                  fontSize: 14.5,
                                  lineHeight: 1.45,
                                  color: "var(--ink-900)",
                                }}
                              >
                                <TextoResaltado
                                  texto={fragmentoAlrededor(f.texto, consulta)}
                                  consulta={consulta}
                                />
                              </span>
                              <span style={{ ...etiqueta, display: "block", marginTop: 4 }}>
                                {[f.remitente, f.fecha].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>

                      {restantes > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDesplegados((p) => ({ ...p, [res.backupId]: true }))
                          }
                          style={{
                            marginTop: 6,
                            marginLeft: 44,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "var(--font-sans)",
                            fontSize: 13.5,
                            color: "var(--brass-600)",
                          }}
                        >
                          {enTexto(t("Ver {{n}} más", { n: restantes }))}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const filaBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  cursor: "pointer",
  textAlign: "left",
};

const nombreFila: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-sans)",
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--ink-900)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default ResultadosGlobales;
