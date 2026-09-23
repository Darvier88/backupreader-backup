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
  const { fullPath, getAsset } = useContext(StorageContext);
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

  function convertOpusToMp3(filename: string): string {
    if (filename.endsWith('.opus')) {
        return filename.slice(0, -5) + '.mp3';
    }
    return filename;
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

  const renderChatImage = () => {
    if (imageUrl) {
      return <ChatImage message={imageUrl} />;
    }
    if (mediaError) return mediaErrorBox;
    return null; // Or some placeholder/loading indicator
  };

  const renderChatVideo = () => {
    if (videoUrl) {
      return <ChatVideoPlayer message={videoUrl} />
    }
    if (mediaError) return mediaErrorBox;
    return null; 
  };

  const renderChatAudio = () => {
    if (audioUrl) {
      return <ChatAudioPlayer message={audioUrl} />
    }
    if (mediaError) return mediaErrorBox;
    return null; 
  };

  function extractPathUpToInstagramActivity(fullPath: string): string {
    const constantSubstring = "/your_instagram_activity/";
    const index = fullPath.indexOf(constantSubstring);

    if (index !== -1) {
        return fullPath.substring(0, index);
    } else {
        return fullPath;
    }
  }

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


  useEffect(() => {

      /*
        First determine if it is an instagram image, to remove the reduntant path
        to not going through every message it asks if it's a video , image or audio.
      */
      let parsedPath: string = fullPath || "";
     if(fullPath && (isImageInView || isVideoInView || isAudioInView)){

      if(fullPath.includes('/your_instagram_activity/')){
        parsedPath = extractPathUpToInstagramActivity(fullPath);
      }else{
        parsedPath = fullPath;
      }
      
     }
        
    
    if (isImageInView && message && fullPath) {

      const imagePath = extractFilename(message);
      if (!imagePath) return;
      
      if(isImageUri(message)){
        getAsset(parsedPath + '/' + imagePath.replace(/[\W_]+$/, ''))
        .then((imageURL)=>{
          setImageUrl(imageURL)
        })
        .catch((error)=>{
          console.log('[MEDIA] Falló imagen: ' + parsedPath + '/' + imagePath, error)
          setImageUrl('')
          setMediaError(true)
        });  
      }else{
        console.log('it is not an image...')
      }
    }else if(isVideoInView && message && fullPath){

      const VideoPath = extractFilename(message);

      if(!VideoPath) return;

      getAsset(parsedPath + '/' + VideoPath.replace(/[\W_]+$/, ''))
        .then((videoURL)=>{
          setVideoUrl(videoURL)
        })
        .catch((error)=>{
          console.log('[MEDIA] Falló video: ' + parsedPath + '/' + VideoPath, error)
          setVideoUrl('')
          setMediaError(true)
        });  

    }else if(isAudioInView && message && fullPath){

      const audioPath = extractFilename(message);

      if(!audioPath) return;
      const audioMP3 = convertOpusToMp3(audioPath).replace(/[\W_]+$/, '');

      if(audioMP3.endsWith('.mp3')){
        getAsset(fullPath + '/' + audioMP3)
        .then((audioURL)=>{
          setAudioUrl(audioURL)
        })
        .catch((error)=>{
          console.log('[MEDIA] Falló audio: ' + fullPath + '/' + audioMP3, error)
          setAudioUrl('')
          setMediaError(true)
        });  
      }
      
    }

  }, [message, fullPath, getAsset, isImageInView, isVideoInView, isAudioInView]);
  


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
