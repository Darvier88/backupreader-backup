import { FC, useRef, useContext, useState, useEffect } from "react";

import { ChatAudioPlayer } from ".";

import { Typography } from "@mui/material";
import { Container } from "@nextui-org/react";
import { ChatImage, ChatVideoPlayer } from ".";
import { TextoResaltado } from "./TextoResaltado";
import { cuantasVeces } from "../../lib/busqueda/resaltar";
import { partirFechaHora } from "../../lib/fechas-de-chat";
import { StorageContext } from '../../context/StorageContext';

import useInView from '../../hooks/useInView';
import { TarjetaDocumento } from "./TarjetaDocumento";
import { documentoAdjunto, nombreDelAdjunto } from "../../lib/nombre-de-adjunto";
import { useTranslation } from "react-i18next";

const styles = {
  messageContainer: {
    backgroundColor: "#E4ECF8",
    padding: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  audioContainer: {
    backgroundColor: "#E4ECF8",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    padding: 4,
  },
  imageContainer: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
    borderRadius: 10,
  },
};

type ChatViewProps = {
  date: string;
  message: string;
  messenger: string;
  chatSearch: string;
  /** Indice global de la coincidencia en la que esta el usuario. */
  coincidenciaActiva?: number | null;
  /** En que numero global empiezan las coincidencias de este mensaje. */
  desplazamiento?: number;
  toShow: "photos" | "message";
  isMine?: boolean;
  /** Falso en los mensajes seguidos del mismo remitente (1a). */
  mostrarRemitente?: boolean;
  gallery?: boolean;
};

export const ChatView: FC<ChatViewProps> = ({
  message,
  messenger,
  date,
  chatSearch,
  coincidenciaActiva = null,
  desplazamiento = 0,
  toShow,
  isMine,
  mostrarRemitente = true,
  gallery,
}) => {

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<boolean>(false);
  const [tooLarge, setTooLarge] = useState<boolean>(false);
  const { fullPath, getMediaUrl } = useContext(StorageContext);
  const { t } = useTranslation();





  function isImageUri(message: string | undefined): boolean {
    const imageUriPattern = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)\b/i;
    return message ? imageUriPattern.test(message) : false;
  }

  function isAudioUri(message: string | undefined): boolean {
    const audioPattern = /\.(opus|mp3|m4a|aac|wav|ogg|flac)\b/i;
    return message ? audioPattern.test(message) : false;
  }

  function isVideoUri(message: string | undefined): boolean {
    const videoPattern = /\.(mp4|mov|avi|mkv|webm|3gp|wmv|flv)\b/i;
    return message ? videoPattern.test(message) : false;
  }
  


  function isVideoFileUrl(url: string): boolean {
    const videoFilePattern = /\.(mp4|avi|mov|wmv|flv|mkv|webm)$/i;
    return videoFilePattern.test(url);
  }

  const imageRef = useRef(null);
  const isImageInView = useInView(imageRef);
  
  const audioRef = useRef(null);
  const isAudioInView = useInView(audioRef);

  const videoRef = useRef(null);
  const isVideoInView = useInView(videoRef);

  const mediaErrorBox = (
    <div style={{ padding: 10, opacity: 0.6, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--slate-700)" }}>
      ⚠ No se pudo cargar el archivo
    </div>
  );

  /* Por encima de 300 MiB no se descifra para mostrar: meter un archivo así en
     un <video> congela la pantalla en móvil. Ver INLINE_PLAYBACK_MAX_BYTES. */
  const tooLargeBox = (
    <div style={{ padding: 10, opacity: 0.7, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--slate-700)" }}>
      Archivo demasiado grande para mostrarlo aquí
    </div>
  );

  const renderChatImage = () => {
    if (imageUrl) {
      return <ChatImage message={imageUrl} />;
    }
    if (tooLarge) return tooLargeBox;
    if (mediaError) return mediaErrorBox;
    return null;
  };

  const renderChatVideo = () => {
    if (videoUrl) {
      return <ChatVideoPlayer message={videoUrl} />
    }
    if (tooLarge) return tooLargeBox;
    if (mediaError) return mediaErrorBox;
    return null;
  };

  const renderChatAudio = () => {
    if (audioUrl) {
      return <ChatAudioPlayer message={audioUrl} />
    }
    if (tooLarge) return tooLargeBox;
    if (mediaError) return mediaErrorBox;
    return null;
  };

  const extractFilename = nombreDelAdjunto;


  /**
   * Resuelve el archivo del mensaje cuando entra en pantalla.
   *
   * Antes esto armaba la ruta de Storage a mano y llamaba a `getAsset`. Con
   * los backups cifrados eso ya no sirve: los nombres son opacos y hay que
   * preguntarle al manifiesto. `getMediaUrl` encapsula los dos caminos, así
   * que aquí no hay rastro de v1 ni de v2.
   *
   * El cleanup revoca el object URL. En v1 no hacía falta porque la URL era
   * remota; en v2 cada archivo visto es un blob descifrado en memoria, y sin
   * revocar, un chat largo con carga perezosa los va acumulando todos.
   */
  useEffect(() => {
    const enPantalla = isImageInView || isVideoInView || isAudioInView;
    if (!enPantalla || !message || !fullPath) return;
    /* Si ya se sabe que el archivo falta o es demasiado grande, no se vuelve
       a pedir. Este efecto se repite cada vez que cambia `getMediaUrl` (en
       cada render del contexto), y sin esta salida un adjunto perdido se
       pedía una y otra vez. */
    if (mediaError || tooLarge) return;

    const nombre = extractFilename(message);
    if (!nombre) return;

    let cancelado = false;
    let urlAsignada: string | null = null;
    let hayQueRevocar = false;

    const aplicar = (url: string | null) => {
      if (isImageInView) setImageUrl(url);
      else if (isVideoInView) setVideoUrl(url);
      else if (isAudioInView) setAudioUrl(url);
    };

    getMediaUrl(nombre)
      .then((r) => {
        if (cancelado) {
          /* El componente salió de pantalla mientras se descifraba: hay que
             soltar el blob igualmente, o se queda huérfano en memoria. */
          if (r.estado === "ok" && r.revocar) URL.revokeObjectURL(r.url);
          return;
        }
        if (r.estado === "ok") {
          urlAsignada = r.url;
          hayQueRevocar = r.revocar;
          aplicar(r.url);
          return;
        }
        if (r.estado === "demasiado-grande") {
          setTooLarge(true);
          return;
        }
        console.log("[MEDIA] no se encontró:", nombre);
        setMediaError(true);
      })
      .catch((error) => {
        if (cancelado) return;
        console.log("[MEDIA] falló:", nombre, error);
        setMediaError(true);
      });

    return () => {
      cancelado = true;
      if (urlAsignada && hayQueRevocar) URL.revokeObjectURL(urlAsignada);
    };
  }, [message, fullPath, getMediaUrl, isImageInView, isVideoInView, isAudioInView, mediaError, tooLarge]);
  


  const documento = documentoAdjunto(message);
  const archivoDocumento = documento?.archivo ?? null;
  const isMedia = isAudioUri(message) || isImageUri(message) || isVideoUri(message) || !!archivoDocumento;
  /* Solo la burbuja con la coincidencia actual lleva aro ocre (1c); el resto
     de coincidencias se marcan dentro del texto, sin tocar la burbuja. */
  const enEsta = chatSearch && chatSearch.trim().length >= 2 && !isMedia ? cuantasVeces(message || "", chatSearch) : 0;
  const highlighted =
    enEsta > 0 &&
    typeof coincidenciaActiva === "number" &&
    coincidenciaActiva >= (desplazamiento ?? 0) &&
    coincidenciaActiva < (desplazamiento ?? 0) + enEsta;

  /* Burbujas como en 1a: enviadas en menta clara a la derecha, recibidas en
     blanco a la izquierda; el remitente arriba (solo al empezar una racha) y
     la hora abajo a la derecha. En galería se mantiene la tarjeta con fecha.
     Un mensaje sin remitente es un aviso del sistema y va centrado. */
  const esSistema = !gallery && !isMedia && !(messenger || "").trim();
  const cardBg = isMine ? "var(--brass-100)" : "#fff";
  const cardBorder = isMine ? "1px solid rgba(47,126,108,0.18)" : "1px solid var(--border)";
  const radio = isMine
    ? mostrarRemitente ? "12px 4px 12px 12px" : 12
    : mostrarRemitente ? "4px 12px 12px 12px" : 12;
  const hora = gallery ? date : partirFechaHora(date).hora || date;

  if (esSistema) {
    return (
      <Container style={{ marginTop: 10, display: "flex", justifyContent: "center", padding: 0 }} key={"chatview"}>
        <div
          style={{
            maxWidth: 300,
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: 1.45,
            color: "var(--slate-700)",
            background: "var(--paper-50)",
            border: "1px solid var(--border)",
            boxShadow: highlighted ? "0 0 0 2px var(--ochre-600)" : "none",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          <TextoResaltado
            texto={message}
            consulta={chatSearch}
            activa={coincidenciaActiva}
            desplazamiento={desplazamiento}
          />
        </div>
      </Container>
    );
  }

  return (
    <Container style={gallery ? { marginTop: 0, padding: 0, width: "100%", minWidth: 0, display: "block" } : { marginTop: mostrarRemitente ? 10 : 6, display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", padding: 0 }} key={'chatview'}>
      <div
        className="br-burbuja"
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: gallery ? 10 : radio,
          boxShadow: highlighted ? "0 0 0 2px var(--ochre-600)" : isMine ? "none" : "0 1px 2px rgba(22,35,59,0.05)",
          padding: gallery ? 16 : "9px 12px 7px",
          maxWidth: gallery ? "100%" : "82%",
          width: gallery ? "100%" : "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Remitente arriba. Solo la hora va en la burbuja: el día lo pone el
            separador de arriba, una vez por día. */}
        {gallery ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brass-600)" }}>{messenger}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-500)" }}>{hora}</span>
          </div>
        ) : (
          !isMine && mostrarRemitente && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brass-600)" }}>{messenger}</div>
          )
        )}

        {/* Contenido: media o texto */}
        {isAudioUri(message) ? (
          <div style={{ ...styles.audioContainer }} ref={audioRef}>
            {renderChatAudio()}
          </div>
        ) : isImageUri(message) ? (
          <div style={{ ...styles.imageContainer }} ref={imageRef}>
            {renderChatImage()}
          </div>
        ) : isVideoUri(message) ? (
          <div style={{ ...styles.imageContainer }} ref={videoRef}>
            {renderChatVideo()}
          </div>
        ) : archivoDocumento ? (
          <>
            <TarjetaDocumento archivo={archivoDocumento} ancho={!!gallery} />
            {documento?.resto && (
              <p className="br-mensaje" style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.45, color: isMine ? "var(--ink-900)" : "var(--slate-900)" }}>
                {documento.resto}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="br-mensaje" style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.45, color: isMine ? "var(--ink-900)" : "var(--slate-900)" }}>
              {/* Se marca el termino DENTRO del texto. Antes cambiaba de color
                  la burbuja entera, que dice en que mensaje esta la palabra
                  pero no donde: en un mensaje largo hay que releerlo. */}
              <TextoResaltado
                texto={message}
                consulta={chatSearch}
                activa={coincidenciaActiva}
                desplazamiento={desplazamiento}
              />
            </p>
            {message?.match(/https?:\/\/\S+/)?.[0] && (
              <a href={message.match(/https?:\/\/\S+/)?.[0] ?? "#"} target="_blank" rel="noopener noreferrer">
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--brass-600)" }}>
                  {t("Ver publicación")}
                </span>
              </a>
            )}
          </>
        )}
        {!gallery && (
          <div style={{ alignSelf: "flex-end", fontFamily: "var(--font-mono)", fontSize: 10.5, color: isMine ? "var(--brass-700)" : "var(--slate-400)" }}>
            {hora}
          </div>
        )}
      </div>
    </Container>
  );
};
