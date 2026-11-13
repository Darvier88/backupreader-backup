import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext, type FragmentoMensaje } from "../../context/StorageContext";
import { usePanelChats } from "../../context/PanelChatsContext";
import { avisoDeBusqueda } from "../../lib/busqueda/indexador";
import type { ResultadoEnChat } from "../../lib/busqueda/indice";
import { fragmentoAlrededor } from "../../lib/busqueda/resaltar";
import { backupIdDeHandle, handleDeBackup } from "../../lib/backupreader-crypto";
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
  anchoCompleto = false,
  onConsulta,
}: {
  consulta: string;
  /** Para «Borrar búsqueda» y la palabra sugerida de 11c. */
  onConsulta?: (valor: string) => void;
  alAbrirChat: (handle: string, nombre: string) => void;
  /** En escritorio hay sitio para dos columnas: mensajes y personas (8c). */
  anchoCompleto?: boolean;
}) => {
  const { t } = useTranslation();
  const { buscarEnTodos, fragmentosDeChat, estadoIndexado, fileList } = useContext(StorageContext);
  /* Sin coincidencias (11c): la palabra de la búsqueda que sí tiene, si la hay. */
  const [sugerida, setSugerida] = useState<{ palabra: string; total: number } | null>(null);
  const { irAMensaje, setPorChat, chatFiltro, setChatFiltro } = usePanelChats();
  /* «Más recientes primero» (8c). El índice devuelve los mensajes en el orden
     del chat, del más antiguo al más nuevo; lo que se busca suele ser reciente,
     así que por defecto se piden y se enseñan los últimos. */
  const [orden, setOrden] = useState<"recientes" | "antiguos">("recientes");
  /* Qué resultado está marcado para el teclado (8c): ↓ pasa al siguiente,
     ↵ lo abre en el chat. `null` es "ninguno todavía", que es distinto de
     "el primero": al escribir no se marca nada, para que ↵ no abra un chat
     que el usuario aún no ha mirado. */
  const [marcado, setMarcado] = useState<number | null>(null);

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
      setPorChat({});
      setChatFiltro(null);
      setMarcado(null);
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
        setSugerida(null);
        /* El panel lateral enseña estos números junto a cada chat (8c). Los
           chats sin nada salen con 0, no en blanco: así se ve que también se
           buscó en ellos (11c). */
        const ceros: Record<string, number> = {};
        for (const f of (fileList || []) as any[]) {
          if (f?.bloqueado) continue;
          const id = backupIdDeHandle(f.fullPath);
          if (id) ceros[id] = 0;
        }
        setPorChat({
          ...ceros,
          ...Object.fromEntries(r.resultados.map((x) => [x.backupId, x.total])),
        });
        /* Nada con la frase entera: se prueba cada palabra y se sugiere la
           que más coincidencias tiene (11c). Solo en escritorio, que es
           donde se enseña. */
        if (anchoCompleto && r.resultados.length === 0) {
          const palabras = Array.from(new Set(texto.split(/\s+/).filter((p) => p.length >= 2)));
          if (palabras.length > 1) {
            let mejor: { palabra: string; total: number } | null = null;
            for (const palabra of palabras) {
              const rp = await buscarEnTodos(palabra);
              if (!vigente) return;
              const n = rp.resultados.reduce((a, x) => a + x.total + x.contactos.length, 0);
              if (n > 0 && (!mejor || n > mejor.total)) mejor = { palabra, total: n };
            }
            if (vigente) setSugerida(mejor);
          }
        }
        setMarcado(null);
        setDesplegados({});
        setFragmentos({});
        setBuscando(false);

        /* Los fragmentos se piden DESPUÉS de pintar los recuentos. Descifrar
           tarda, y esperar a tenerlo todo dejaría la pantalla en blanco
           mientras ya se sabe en qué chats hay algo. */
        for (const res of r.resultados) {
          if (!vigente) return;
          const ordenados = [...res.mensajes].sort((a, b) =>
            orden === "recientes" ? b - a : a - b
          );
          const quiero = ordenados.slice(0, 10);
          if (quiero.length === 0) continue;
          const trozos = await fragmentosDeChat(res.backupId, quiero);
          if (!vigente) return;
          const enOrden = [...trozos].sort((a, b) =>
            orden === "recientes" ? b.mensaje - a.mensaje : a.mensaje - b.mensaje
          );
          setFragmentos((prev) => ({ ...prev, [res.backupId]: enOrden }));
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
  }, [consulta, orden]);

  const aviso = avisoDeBusqueda(estadoIndexado);
  const hayQueAvisar = aviso.clave !== "completa" || sinIndexar > 0;

  /* Al pulsar un chat en el panel se ven solo sus resultados (8c). Si ese
     chat ya no tiene coincidencias con la búsqueda actual, el filtro no
     aplica: dejaría la pantalla vacía sin explicar por qué. */
  const filtroVigente =
    chatFiltro && resultados.some((r) => r.backupId === chatFiltro) ? chatFiltro : null;
  const visibles = filtroVigente
    ? resultados.filter((r) => r.backupId === filtroVigente)
    : resultados;
  const conPersonas = visibles.filter((r) => r.contactos.length > 0);
  const conMensajes = visibles.filter((r) => r.total > 0);
  const nPersonas = conPersonas.reduce((n, r) => n + r.contactos.length, 0);
  const nMensajes = conMensajes.reduce((n, r) => n + r.total, 0);

  /* Los mensajes en el orden en que se ven, para que ↓ recorra lo mismo que
     se lee. Se recalcula con los fragmentos porque hasta que no llegan no hay
     nada que abrir. */
  const navegables: Array<{ res: ResultadoEnChat; mensaje: number }> = [];
  for (const res of conMensajes) {
    const trozos = fragmentos[res.backupId];
    if (!trozos) continue;
    const vistos = desplegados[res.backupId] ? trozos : trozos.slice(0, POR_CHAT);
    for (const f of vistos) navegables.push({ res, mensaje: f.mensaje });
  }

  const abrirEnMensaje = (res: ResultadoEnChat, numero: number) => {
    irAMensaje({ consulta: consulta.trim(), mensaje: numero });
    alAbrirChat(handleDeBackup(res.backupId), res.nombre);
  };

  useEffect(() => {
    if (!anchoCompleto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (navegables.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMarcado((m) => (m === null ? 0 : Math.min(m + 1, navegables.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMarcado((m) => (m === null ? 0 : Math.max(m - 1, 0)));
        return;
      }
      if (e.key === "Enter" && marcado !== null) {
        /* Solo si hay algo marcado. Con ↵ a secas desde el campo de texto se
           abriría el primer resultado sin que nadie lo haya elegido. */
        e.preventDefault();
        const elegido = navegables[marcado];
        if (elegido) abrirEnMensaje(elegido.res, elegido.mensaje);
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  });

  const avatar = (nombre: string) => (
    <span
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        background: "var(--paper-100)",
        border: "1px solid var(--border)",
        fontFamily: "var(--font-serif)",
        fontSize: 13,
        color: "var(--ink-900)",
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
          color: activo ? "var(--paper-50)" : "var(--ink-800)",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {texto}
      </button>
    );
  };

  /* La salida temprana va aquí y no arriba: por encima hay un `useEffect`
     (los atajos de teclado) y un hook que a veces no se ejecuta deja de ser
     un hook. */
  if (consulta.trim().length < 2) return null;

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

      {!buscando && resultados.length === 0 && !hayQueAvisar && !anchoCompleto && (
        <p style={etiqueta}>{enTexto(t("Sin coincidencias en otros chats."))}</p>
      )}

      {/* Sin coincidencias en escritorio (11c): los filtros en cero, sin
          ocultarse, para que quede claro que se buscó en todo; qué probar; y
          las dos salidas. */}
      {!buscando && resultados.length === 0 && anchoCompleto && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {botonFiltro("todo", enTexto(t("Todo · {{n}}", { n: 0 })))}
            {botonFiltro("personas", enTexto(t("Personas · {{n}}", { n: 0 })))}
            {botonFiltro("mensajes", enTexto(t("Mensajes · {{n}}", { n: 0 })))}
          </div>
          <div style={{ maxWidth: 480, margin: "56px auto 0", display: "flex", flexDirection: "column", gap: 24 }}>
            <span aria-hidden style={{ width: 52, height: 52, borderRadius: 12, background: "var(--paper-100)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--slate-500)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5" />
              </svg>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.015em", color: "var(--ink-900)", overflowWrap: "anywhere" }}>
                {enTexto(t("No encontramos «{{q}}»", { q: consulta.trim() }))}
              </h2>
              <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--slate-700)" }}>
                {(fileList?.length ?? 0) === 1
                  ? enTexto(t("Buscamos en tu chat, en nombres y mensajes."))
                  : enTexto(t("Buscamos en tus {{n}} chats, en nombres y mensajes.", { n: fileList?.length ?? 0 }))}
              </p>
            </div>
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {sugerida && (
                <div className="br-consejo">
                  {enTexto(t("Prueba con una sola palabra:"))}{" "}
                  <button type="button" onClick={() => onConsulta?.(sugerida.palabra)} style={{ padding: 0, border: 0, background: "transparent", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--brass-600)", cursor: "pointer" }}>
                    {sugerida.palabra}
                  </button>{" "}
                  {sugerida.total === 1
                    ? enTexto(t("tiene 1 coincidencia."))
                    : enTexto(t("tiene {{n}} coincidencias.", { n: sugerida.total }))}
                </div>
              )}
              <div className="br-consejo">{enTexto(t("Revisa la ortografía. No distinguimos tildes ni mayúsculas."))}</div>
              <div className="br-consejo">{enTexto(t("¿Está en otro chat? Súbelo y lo incluimos en la búsqueda."))}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="br-btn br-btn-ghost br-btn-md" style={{ border: "1.5px solid var(--ink-900)" }} onClick={() => onConsulta?.("")}>
                {enTexto(t("Borrar búsqueda"))}
              </button>
              <button
                type="button"
                className="br-btn br-btn-ghost br-btn-md"
                onClick={() => window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "archivos" }))}
              >
                {enTexto(t("Agregar chat"))}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultados.length > 0 && (
        <>
          {/* Filtros con su recuento: dicen cuánto hay de cada cosa antes de
              pulsar, así que también sirven de resumen. */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            {/* Con recuento en escritorio (8c); en el móvil «Todo» a secas (3b). */}
            {botonFiltro("todo", anchoCompleto ? enTexto(t("Todo · {{n}}", { n: nPersonas + nMensajes })) : enTexto(t("Todo")))}
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
                      {/* El chat elegido en el panel, con una × para volver a todos. */}
            {filtroVigente && (
              <button
                type="button"
                onClick={() => setChatFiltro(null)}
                aria-label={enTexto(t("Ver resultados de todos los chats"))}
                style={{
                  minHeight: 32,
                  padding: "0 12px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: "1px solid var(--brass-500)",
                  background: "var(--paper-100)",
                  color: "var(--ink-900)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                }}
              >
                {enTexto(
                  t("Solo {{chat}}", {
                    chat:
                      nombreDelContacto(
                        resultados.find((r) => r.backupId === filtroVigente)?.nombre ?? ""
                      ) || "",
                  })
                )}{" "}
                ×
              </button>
            )}
            {/* Orden (8c). Un solo control que alterna, para no abrir un menú
                por dos opciones. Solo en escritorio: en el móvil no cabe en la
                fila de filtros (3b). */}
            {anchoCompleto && <button
              type="button"
              onClick={() => setOrden((o) => (o === "recientes" ? "antiguos" : "recientes"))}
              style={{
                marginLeft: "auto",
                minHeight: 32,
                padding: "0 4px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--slate-700)",
              }}
            >
              {orden === "recientes"
                ? enTexto(t("Más recientes primero"))
                : enTexto(t("Más antiguos primero"))}{" "}
              ↕
            </button>}
          </div>

          {/* Dos columnas en escritorio: los mensajes son lo que se lee y
              ocupan el ancho; las personas son una lista corta de nombres y
              debajo de los mensajes quedaban fuera de pantalla justo cuando
              hay muchas coincidencias, que es cuando más falta hacen (8c). */}
          <div
            style={
              anchoCompleto
                ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 300px)", gap: 32, alignItems: "start" }
                : undefined
            }
          >
          <div style={{ minWidth: 0, order: anchoCompleto ? 1 : undefined }}>
          {(filtro === "todo" || filtro === "personas") && nPersonas > 0 && anchoCompleto === false && (
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
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                {conMensajes.map((res) => {
                  const trozos = fragmentos[res.backupId];
                  const todos = desplegados[res.backupId];
                  const aEnsenar = trozos ? (todos ? trozos : trozos.slice(0, POR_CHAT)) : [];
                  const restantes = (trozos?.length ?? 0) - aEnsenar.length;

                  /* Una tarjeta por chat (3b/8c): el nombre y el recuento
                     arriba, los mensajes en filas separadas por una línea y
                     «Ver N más» al pie. */
                  return (
                    <div key={res.backupId} style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                        <span style={{ ...nombreFila, fontSize: 14, minWidth: 0 }}>
                          {nombreDelContacto(res.nombre) || res.nombre}
                        </span>
                        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--slate-500)", whiteSpace: "nowrap" }}>
                          {res.aproximado
                            ? enTexto(t("Más de {{total}} coincidencias", { total: res.total }))
                            /* Singular cuando es una. "1 COINCIDENCIAS" se lee
                               como un error de la aplicación. */
                            : res.total === 1
                            ? enTexto(t("1 coincidencia"))
                            : enTexto(t("{{total}} coincidencias", { total: res.total }))}
                        </span>
                      </div>

                      {/* Mientras se descifra ese chat, su hueco dice que
                          está en camino en vez de parecer que no hay nada. */}
                      {!trozos && (
                        <p style={{ ...etiqueta, margin: 0, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                          {enTexto(t("Abriendo…"))}
                        </p>
                      )}

                      {aEnsenar.map((f) => {
                        const indice = navegables.findIndex(
                          (n) => n.res.backupId === res.backupId && n.mensaje === f.mensaje
                        );
                        const activo = marcado !== null && indice === marcado;
                        return (
                          <button
                            key={f.mensaje}
                            type="button"
                            ref={(el) => { if (activo && el) el.scrollIntoView({ block: "nearest" }); }}
                            onClick={() => abrirEnMensaje(res, f.mensaje)}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              gap: 16,
                              width: "100%",
                              padding: activo ? "12px 16px" : anchoCompleto ? "12px 16px 12px 35px" : "10px 16px",
                              border: "none",
                              borderTop: "1px solid var(--border)",
                              background: activo ? "var(--paper-50)" : "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {activo && (
                              <span aria-hidden style={{ width: 3, flexShrink: 0, borderRadius: 2, background: "var(--ochre-600)" }} />
                            )}
                            <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontFamily: "var(--font-sans)", fontSize: anchoCompleto ? 14.5 : 14, lineHeight: 1.45, color: "var(--slate-900)" }}>
                                <TextoResaltado
                                  texto={fragmentoAlrededor(f.texto, consulta)}
                                  consulta={consulta}
                                />
                              </span>
                              <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--slate-400)" }}>
                                {[f.remitente, f.fecha].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            {activo && anchoCompleto && (
                              <span style={{ alignSelf: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--brass-600)" }}>
                                {enTexto(t("Abrir en el chat"))}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {restantes > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDesplegados((p) => ({ ...p, [res.backupId]: true }))
                          }
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "transparent",
                            border: "none",
                            borderTop: "1px solid var(--border)",
                            cursor: "pointer",
                            fontFamily: "var(--font-sans)",
                            fontSize: 13.5,
                            fontWeight: 600,
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
          </div>

          {/* La columna derecha sale siempre que haya resultados, aunque no
              haya ninguna persona: los atajos son del buscador, no de las
              personas, y antes desaparecían en cuanto se buscaba una palabra
              que no era un nombre, que es el caso normal. */}
          {anchoCompleto && (
            <div style={{ minWidth: 0, order: 2 }}>
              {(filtro === "todo" || filtro === "personas") && nPersonas > 0 && (
              <>
              <p style={etiqueta}>{enTexto(t("Personas"))}</p>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {conPersonas.map((res) =>
                  res.contactos.map((persona) => (
                    <button
                      key={`${res.backupId}-${persona}`}
                      type="button"
                      onClick={() => alAbrirChat(handleDeBackup(res.backupId), res.nombre)}
                      style={{ ...filaBase, alignItems: "flex-start" }}
                    >
                      {avatar(persona)}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={nombreFila}>
                          <TextoResaltado texto={persona} consulta={consulta} />
                        </span>
                        <span style={{ ...etiqueta, display: "block", marginTop: 2 }}>
                          {enTexto(t("Mencionado en {{chat}}", { chat: nombreDelContacto(res.nombre) || res.nombre }))}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              </>
              )}

              {/* Los atajos, escritos. Un atajo que no se anuncia no lo usa
                  nadie, y aquí hay sitio de sobra para decirlo. */}
              <div style={{ marginTop: 12, padding: "12px 12px 14px", background: "var(--paper-100)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <p style={etiqueta}>{enTexto(t("Atajos"))}</p>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    [enTexto(t("Siguiente resultado")), "↓"],
                    [enTexto(t("Abrir en el chat")), "↵"],
                    [enTexto(t("Cerrar búsqueda")), "ESC"],
                  ].map(([que, tecla]) => (
                    <div key={tecla} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13.5, color: "var(--slate-700)" }}>{que}</span>
                      <kbd
                        style={{
                          fontFamily: mono,
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--paper-100)",
                          color: "var(--slate-700)",
                        }}
                      >
                        {tecla}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
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
