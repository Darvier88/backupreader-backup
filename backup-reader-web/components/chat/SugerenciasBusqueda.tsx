import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext, type FragmentoMensaje } from "../../context/StorageContext";
import type { ResultadoEnChat } from "../../lib/busqueda/indice";
import { fragmentoAlrededor } from "../../lib/busqueda/resaltar";
import { handleDeBackup } from "../../lib/backupreader-crypto";
import { iniciales, nombreDelContacto } from "../../lib/nombres-de-chat";
import { TextoResaltado } from "./TextoResaltado";

/**
 * Sugerencias al escribir en el buscador del inicio, en escritorio (11a).
 *
 * Desde dos letras sale un panel bajo el campo con lo más relevante: las
 * personas primero y luego hasta tres mensajes. ↑↓ se mueve, ↵ abre lo
 * marcado y ⇧↵ —o «Ver los N resultados»— pasa a la vista completa (8c).
 *
 * Se marca el primero de entrada (a diferencia de la vista completa): aquí la
 * lista es corta y está pegada al campo, así que ↵ abre lo que se tiene
 * delante, que es lo que hace cualquier buscador con sugerencias.
 */

const RETARDO_MS = 200;
const MAX_MENSAJES = 3;
const MAX_PERSONAS = 3;

const enTexto = (v: unknown): string => (v as string | null | undefined) ?? "";
const mono = "var(--font-mono)";

type Opcion =
  | { tipo: "persona"; persona: string; res: ResultadoEnChat }
  | { tipo: "mensaje"; f: FragmentoMensaje; res: ResultadoEnChat };

export const SugerenciasBusqueda = ({
  consulta,
  alAbrirChat,
  alAbrirMensaje,
  alVerTodo,
}: {
  consulta: string;
  alAbrirChat: (handle: string, nombre: string) => void;
  alAbrirMensaje: (handle: string, nombre: string, mensaje: number) => void;
  alVerTodo: () => void;
}) => {
  const { t } = useTranslation();
  const { buscarEnTodos, fragmentosDeChat } = useContext(StorageContext);
  const [resultados, setResultados] = useState<ResultadoEnChat[] | null>(null);
  const [mensajes, setMensajes] = useState<Array<{ f: FragmentoMensaje; res: ResultadoEnChat }>>([]);
  const [marcado, setMarcado] = useState(0);

  useEffect(() => {
    const texto = consulta.trim();
    if (texto.length < 2) {
      setResultados(null);
      setMensajes([]);
      return;
    }
    let vigente = true;
    const temporizador = setTimeout(async () => {
      try {
        const r = await buscarEnTodos(texto);
        if (!vigente || r.consulta !== texto) return;
        setResultados(r.resultados);
        setMarcado(0);
        /* Los tres mensajes más recientes, repartidos entre los chats con
           coincidencias: el más nuevo de cada uno primero. */
        const reunidos: Array<{ f: FragmentoMensaje; res: ResultadoEnChat }> = [];
        for (const res of r.resultados) {
          if (reunidos.length >= MAX_MENSAJES) break;
          const ultimos = [...res.mensajes].sort((a, b) => b - a).slice(0, MAX_MENSAJES - reunidos.length);
          if (ultimos.length === 0) continue;
          const trozos = await fragmentosDeChat(res.backupId, ultimos);
          if (!vigente) return;
          for (const f of trozos) reunidos.push({ f, res });
        }
        setMensajes(reunidos.slice(0, MAX_MENSAJES));
      } catch (error) {
        console.error("Falló la búsqueda de sugerencias:", error);
      }
    }, RETARDO_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);

  const personas: Opcion[] = [];
  for (const res of resultados ?? []) {
    for (const persona of res.contactos) {
      if (personas.length < MAX_PERSONAS) personas.push({ tipo: "persona", persona, res });
    }
  }
  const opciones: Opcion[] = [
    ...personas,
    ...mensajes.map((m) => ({ tipo: "mensaje" as const, ...m })),
  ];
  const total =
    (resultados ?? []).reduce((n, r) => n + r.contactos.length + r.total, 0);

  const abrir = (o: Opcion) => {
    const handle = handleDeBackup(o.res.backupId);
    if (o.tipo === "persona") alAbrirChat(handle, o.res.nombre);
    else alAbrirMensaje(handle, o.res.nombre, o.f.mensaje);
  };

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        alVerTodo();
        return;
      }
      if (opciones.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMarcado((m) => Math.min(m + 1, opciones.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMarcado((m) => Math.max(m - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const o = opciones[marcado];
        if (o) abrir(o);
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  });

  if (consulta.trim().length < 2 || resultados === null) return null;

  /* Nada de nada: la vista completa explica por qué y qué probar (11c). */
  if (total === 0) {
    return (
      <div className="br-sugerencias">
        <button type="button" className="br-sugerencias-pie" onClick={alVerTodo}>
          <span style={{ color: "var(--slate-700)", fontWeight: 400 }}>
            {enTexto(t("Sin coincidencias para «{{q}}».", { q: consulta.trim() }))}
          </span>
          <span>{enTexto(t("Ver sugerencias"))}</span>
        </button>
      </div>
    );
  }

  const tecla = (txt: string) => <kbd className="br-kbd">{txt}</kbd>;
  const etiqueta = (txt: string) => (
    <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)", padding: "0 10px 4px" }}>
      {txt}
    </div>
  );

  return (
    <div className="br-sugerencias" role="listbox" aria-label={enTexto(t("Sugerencias"))}>
      {personas.length > 0 && (
        <div style={{ padding: "12px 8px 8px" }}>
          {etiqueta(enTexto(t("Personas")))}
          {personas.map((o, i) => {
            if (o.tipo !== "persona") return null;
            const activo = marcado === i;
            const chat = nombreDelContacto(o.res.nombre) || o.res.nombre;
            return (
              <button
                key={`${o.res.backupId}-${o.persona}`}
                type="button"
                role="option"
                aria-selected={activo}
                className="br-sugerencia"
                style={{ background: activo ? "var(--paper-100)" : "transparent" }}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => abrir(o)}
              >
                <span className="br-sugerencia-tile">{iniciales(o.persona)}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-900)" }}>
                    <TextoResaltado texto={o.persona} consulta={consulta} />
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--slate-500)" }}>
                    {chat.toLowerCase() === o.persona.toLowerCase()
                      ? enTexto(t("Chat"))
                      : enTexto(t("En {{chat}}", { chat }))}
                  </span>
                </span>
                {activo && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brass-600)" }}>{enTexto(t("Abrir chat"))}</span>
                    {tecla("↵")}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {mensajes.length > 0 && (
        <div style={{ padding: "8px 8px 10px", borderTop: personas.length ? "1px solid var(--border)" : undefined }}>
          {etiqueta(enTexto(t("Mensajes · {{n}}", { n: (resultados ?? []).reduce((n, r) => n + r.total, 0) })))}
          {mensajes.map(({ f, res }, j) => {
            const i = personas.length + j;
            const activo = marcado === i;
            return (
              <button
                key={`${res.backupId}-${f.mensaje}`}
                type="button"
                role="option"
                aria-selected={activo}
                className="br-sugerencia"
                style={{ background: activo ? "var(--paper-100)" : "transparent", padding: "8px 10px" }}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => abrir({ tipo: "mensaje", f, res })}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--slate-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <TextoResaltado texto={fragmentoAlrededor(f.texto, consulta)} consulta={consulta} />
                </span>
                <span style={{ flexShrink: 0, fontFamily: mono, fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--slate-500)" }}>
                  {[f.remitente, f.fecha].filter(Boolean).join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="br-sugerencias-pie" style={{ cursor: "default" }}>
        <button type="button" onClick={alVerTodo} style={{ padding: 0, border: 0, background: "transparent", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--brass-600)", cursor: "pointer" }}>
          {total === 1 ? enTexto(t("Ver el resultado")) : enTexto(t("Ver los {{n}} resultados", { n: total }))}
        </button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--slate-500)", fontWeight: 400 }}>
          {tecla("↑")}
          {tecla("↓")} {enTexto(t("moverse"))} {tecla("⇧ ↵")} {enTexto(t("ver todo"))}
        </span>
      </div>
    </div>
  );
};

export default SugerenciasBusqueda;
