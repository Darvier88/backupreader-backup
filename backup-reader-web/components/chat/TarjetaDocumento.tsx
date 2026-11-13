import { FC, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext } from "../../context/StorageContext";
import { nombreVisible, seAbreEnElNavegador, tipoDeDocumento } from "../../lib/documentos";

/**
 * Un documento adjunto (PDF, Word, Excel…) en el chat y en «Media».
 *
 * No se descifra al entrar en pantalla, como las fotos: un documento no se ve
 * en miniatura y puede pesar mucho, así que se descifra solo al pulsar. Los
 * PDF se abren en otra pestaña (el navegador los enseña); el resto se
 * descarga con su nombre.
 *
 * La pestaña del PDF se abre ANTES de descifrar, en el propio clic: si se
 * abre después de esperar, Safari y Chrome la toman por una ventana emergente
 * y la bloquean.
 */
export const TarjetaDocumento: FC<{ archivo: string; ancho?: boolean }> = ({ archivo, ancho = false }) => {
  const { t } = useTranslation();
  const { getMediaUrl } = useContext(StorageContext);
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error" | "grande">("listo");

  const nombre = nombreVisible(archivo);
  const tipo = tipoDeDocumento(archivo);
  const enPestana = seAbreEnElNavegador(archivo);

  const abrir = async () => {
    if (estado === "abriendo") return;
    setEstado("abriendo");
    const pestana = enPestana ? window.open("", "_blank") : null;
    try {
      const r = await getMediaUrl(archivo);
      if (r.estado !== "ok") {
        pestana?.close();
        setEstado(r.estado === "demasiado-grande" ? "grande" : "error");
        return;
      }
      if (pestana) {
        pestana.location.href = r.url;
      } else {
        const a = document.createElement("a");
        a.href = r.url;
        a.download = nombre;
        a.rel = "noopener";
        /* Las URL de v1 son de otro dominio y ahí `download` no aplica: se
           abren en otra pestaña en vez de quedarse en esta. */
        if (!r.revocar) a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      /* El blob descifrado se suelta al rato: la pestaña o la descarga ya lo
         tienen. Al momento, la pestaña del PDF podría quedarse en blanco. */
      if (r.revocar) setTimeout(() => URL.revokeObjectURL(r.url), 60_000);
      setEstado("listo");
    } catch (error) {
      console.warn("No se pudo abrir el documento:", archivo, error);
      pestana?.close();
      setEstado("error");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        width: ancho ? "100%" : "min(340px, 100%)",
        padding: 10,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--paper-50)",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 48,
          borderRadius: 6,
          background: "var(--paper-200)",
          color: "var(--ink-900)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.04em" }}>
          {archivo.split(".").pop()?.toUpperCase().slice(0, 4)}
        </span>
      </span>
      {/* El nombre pide al menos 150 px; si no caben nombre y botón en la
          misma fila (tarjetas estrechas de «Media», móviles pequeños), el
          botón baja a la fila de abajo en vez de partir el nombre en sílabas. */}
      <div style={{ minWidth: 0, flex: "1 1 150px" }}>
        <div
          title={nombre}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: "var(--ink-900)",
            /* Hasta dos líneas: en una sola, «Contrato de trabajo firmado.pdf»
               se quedaba en «Contrato de tra…» y no se sabía cuál era. */
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            overflowWrap: "break-word",
          }}
        >
          {nombre}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: estado === "error" || estado === "grande" ? "var(--clay-600)" : "var(--slate-500)" }}>
          {estado === "error"
            ? t("No se pudo abrir el documento")
            : estado === "grande"
              ? t("Archivo demasiado grande para abrirlo aquí")
              : t(tipo)}
        </div>
      </div>
      <button
        type="button"
        onClick={abrir}
        disabled={estado === "abriendo"}
        className="br-btn br-btn-ghost br-btn-sm"
        style={{ flexShrink: 0, marginLeft: "auto", cursor: estado === "abriendo" ? "default" : "pointer" }}
      >
        {estado === "abriendo" ? t("Abriendo…") : enPestana ? t("Abrir") : t("Descargar")}
      </button>
    </div>
  );
};
