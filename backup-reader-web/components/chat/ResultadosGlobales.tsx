import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext } from "../../context/StorageContext";
import { avisoDeBusqueda } from "../../lib/busqueda/indexador";
import type { ResultadoEnChat } from "../../lib/busqueda/indice";
import { handleDeBackup } from "../../lib/backupreader-crypto";

/**
 * Resultados de la búsqueda en TODOS los chats, no solo en el abierto.
 *
 * El buscador que ya había filtra los mensajes del chat que se está leyendo.
 * Esto es lo que faltaba: escribir "Yuli" y ver también en qué otros chats
 * aparece, y si hay un contacto que se llama así.
 *
 * SIEMPRE DICE SI LE FALTAN CHATS
 * -------------------------------
 * Mientras la pasada de indexado no termine, hay chats en los que todavía no
 * se puede buscar. Eso se dice, con el número, en vez de enseñar los
 * resultados a secas. Si no, quien busca y no encuentra concluye que el
 * mensaje no existe, cuando lo cierto es que aún no se ha mirado ahí. Una
 * búsqueda lenta se espera; una que calla lo que le falta no se detecta nunca.
 */

/** Espera a que el usuario deje de escribir antes de buscar. */
const RETARDO_MS = 250;

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const ResultadosGlobales = ({
  consulta,
  alAbrirChat,
}: {
  consulta: string;
  /** Abre un chat. Recibe el handle y el nombre, como `getFile`. */
  alAbrirChat: (handle: string, nombre: string) => void;
}) => {
  const { t } = useTranslation();
  const { buscarEnTodos, estadoIndexado, fullPath } = useContext(StorageContext);

  const [resultados, setResultados] = useState<ResultadoEnChat[]>([]);
  const [sinIndexar, setSinIndexar] = useState(0);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const texto = consulta.trim();
    if (texto.length < 2) {
      setResultados([]);
      setSinIndexar(0);
      return;
    }

    /* Sin el retardo se lanzaría una búsqueda por tecla, y cada una recorre
       los índices de todos los chats. */
    let vigente = true;
    setBuscando(true);
    const temporizador = setTimeout(async () => {
      try {
        const r = await buscarEnTodos(texto);
        /* Si el usuario siguió escribiendo, esta respuesta ya no vale: pintarla
           enseñaría los resultados de una consulta anterior. */
        if (!vigente || r.consulta !== texto) return;
        setResultados(r.resultados);
        setSinIndexar(r.sinIndexar);
      } catch (error) {
        console.error("Falló la búsqueda global:", error);
      } finally {
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
  const hayQueDecirAlgo = aviso.clave !== "completa" || sinIndexar > 0;

  if (consulta.trim().length < 2) return null;

  /* Nada que enseñar y nada que avisar: no se pinta un bloque vacío. */
  if (resultados.length === 0 && !buscando && !hayQueDecirAlgo) {
    return (
      <p style={textoTenue}>
        {enTexto(t("Sin coincidencias en otros chats."))}
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {hayQueDecirAlgo && (
        <p style={{ ...textoTenue, color: "var(--brass-600)" }}>
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
        <p style={textoTenue}>{enTexto(t("Buscando…"))}</p>
      )}

      {resultados.length > 0 && (
        <>
          <p style={{ ...textoTenue, marginBottom: 6 }}>
            {enTexto(t("En otros chats"))}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {resultados.map((r) => {
              const handle = handleDeBackup(r.backupId);
              const esElAbierto = handle === fullPath;
              return (
                <button
                  key={r.backupId}
                  type="button"
                  onClick={() => alAbrirChat(handle, r.nombre)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    background: esElAbierto ? "var(--surface-raised)" : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--ink-900)",
                    }}
                  >
                    {r.nombre}
                  </span>
                  <span style={{ ...textoTenue, display: "block", marginTop: 2 }}>
                    {/* El recuento se dice como "más de N" cuando el índice
                        venía recortado, en vez de fingir una cifra exacta. */}
                    {r.total > 0 &&
                      enTexto(
                        t(
                          r.aproximado
                            ? "Más de {{total}} mensaje(s)"
                            : "{{total}} mensaje(s)",
                          { total: r.total }
                        )
                      )}
                    {r.contactos.length > 0 && r.total > 0 ? " · " : ""}
                    {r.contactos.length > 0 &&
                      enTexto(
                        t("Contacto: {{quien}}", { quien: r.contactos.join(", ") })
                      )}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const textoTenue: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11.5,
  letterSpacing: "0.04em",
  color: "var(--slate-500)",
  margin: 0,
};

export default ResultadosGlobales;
