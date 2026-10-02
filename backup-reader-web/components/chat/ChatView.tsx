import { FC, useRef, useContext, useState, useEffect } from "react";

import { ChatAudioPlayer } from ".";

import { Typography } from "@mui/material";
import { Container } from "@nextui-org/react";
import { ChatImage, ChatVideoPlayer } from ".";
import { StorageContext } from '../../context/StorageContext';

import useInView from '../../hooks/useInView';
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
  toShow: "photos" | "message";
  isMine?: boolean;
  gallery?: boolean;
};

export const ChatView: FC<ChatViewProps> = ({
  message,
  messenger,
  date,
  chatSearch,
  toShow,
  isMine,
  gallery,
}) => {

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<boolean>(false);
  const [tooLarge, setTooLarge] = useState<boolean>(false);
  const { fullPath, getMediaUrl } = useContext(StorageContext);
  const { t } = useTranslation();

  const toNormalForm = (string: string) => {
    return string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const onHandleSearchText = () => {
    if (chatSearch === "") return false;
    if (
      toNormalForm(message.toLowerCase()).includes(chatSearch.toLowerCase())
    ) {
      return true;
    }
    return false;
  };


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
    <div style={{ padding: 10, opacity: 0.6, fontFamily: "Open Sans", fontSize: 12, color: "#3C3C3C" }}>
      ⚠ No se pudo cargar el archivo
    </div>
  );

  /* Por encima de 300 MiB no se descifra para mostrar: meter un archivo así en
     un <video> congela la pantalla en móvil. Ver INLINE_PLAYBACK_MAX_BYTES. */
  const tooLargeBox = (
    <div style={{ padding: 10, opacity: 0.7, fontFamily: "Open Sans", fontSize: 12, color: "#3C3C3C" }}>
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

  function extractFilename(text: string): string | null {
    if (!text) return null;
    const clean = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "");

    const mediaExt =
      "jpg|jpeg|png|gif|webp|bmp|tiff|svg|mp4|avi|mov|mkv|webm|3gp|wmv|flv|mpg|mpeg|mp3|wav|aac|flac|opus|m4a|ogg|pdf";

    // 1) "NOMBRE.ext (archivo adjunto)" / "(file attached)"
    let m = clean.match(
      new RegExp(`([^\\s:<>]+\\.(?:${mediaExt}))\\s*\\((?:archivo adjunto|file attached)\\)`, "i")
    );
    if (m) return m[1].trim();

    // 2) Formato con corchetes: "<...: NOMBRE>"
    m = clean.match(/<[^:]+:\s*([^>]+)>/);
    if (m) return m[1].trim();

    // 3) Nombre de archivo suelto con extensión de media
    m = clean.match(new RegExp(`([^\\s:<>]+\\.(?:${mediaExt}))\\b`, "i"));
    if (m) return m[1].trim();

    return null;
  }


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
  }, [message, fullPath, getMediaUrl, isImageInView, isVideoInView, isAudioInView]);
  


  const isMedia = isAudioUri(message) || isImageUri(message) || isVideoUri(message);
  const highlighted = onHandleSearchText();

  // Navy solo para TEXTO propio; la media siempre en tarjeta clara para que se vea.
  const useDark = isMine && !isMedia && !highlighted;
  const cardBg = highlighted
    ? "var(--accent-pale)"
    : useDark ? "var(--ink-900)" : "var(--surface-raised)";
  const cardBorder = highlighted
    ? "1px solid var(--brass-400)"
    : useDark ? "1px solid var(--ink-800)" : "1px solid var(--border)";
  const senderColor = useDark ? "var(--brass-300)" : "var(--brass-600)";
  const dateColor = useDark ? "rgba(255,255,255,0.55)" : "var(--slate-500)";
  const textColor = useDark ? "var(--paper-50)" : "var(--ink-900)";

  return (
    <Container style={gallery ? { marginTop: 0, padding: 0, width: "100%", minWidth: 0, display: "block" } : { marginTop: 12, display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", padding: 0 }} key={'chatview'}>
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 10,
          boxShadow: "var(--shadow-xs)",
          padding: 16,
          maxWidth: gallery ? "100%" : "80%",
          minWidth: gallery ? 0 : 220,
          width: gallery ? "100%" : "auto",
        }}
      >
        {/* Remitente + fecha */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between", marginBottom: isMedia ? 10 : 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: senderColor }}>
            {messenger}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: dateColor }}>
            {date}
          </span>
        </div>

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
        ) : (
          <>
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: textColor }}>
              {message}
            </p>
            {message?.match(/https?:\/\/\S+/)?.[0] && (
              <a href={message.match(/https?:\/\/\S+/)?.[0] ?? "#"} target="_blank" rel="noopener noreferrer">
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: isMine ? "var(--brass-300)" : "var(--brass-600)" }}>
                  {t("Ver publicación")}
                </span>
              </a>
            )}
          </>
        )}
      </div>
    </Container>
  );
};
