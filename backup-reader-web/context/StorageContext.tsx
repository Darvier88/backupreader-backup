import axios, { AxiosResponse } from 'axios';
import utf8 from 'utf8';
import { createContext, useReducer, useContext, useEffect, useRef, useState } from "react";

import {
  ref,
  list,
  deleteObject,
  getDownloadURL,
  uploadBytesResumable,
  getBlob,
  StorageReference,
} from "firebase/storage";

import { storage } from "../config/firebase";
import { FirestoreContext } from "./FirestoreContext";
import { Chat, FileDetail, FileList } from "../models/Files";
import { storageReducer, StorageState } from "./StorageReducer";
import { useLoading } from "../context/LoadingContext";
import { VaultContext } from "./VaultContext";
import { registrarBackup, listarBackups } from "../config/backupRepo";
import {
  uploadBackup,
  cipherBytes,
  newId,
  piecePath,
  manifestPath,
  BLOB_CONTENT_TYPE,
  BLOB_CACHE_CONTROL,
  FORMAT_VERSION,
  abrirBackup,
  leerTextoDelChat,
  resolverMedia,
  handleDeBackup,
  esHandleV2,
  backupIdDeHandle,
  migrarBackupV1,
  verificarMigracion,
  tieneTextoDeChat,
  nombreDesdeCarpeta,
  origenDeRuta,
} from "../lib/backupreader-crypto";
import type { BackupAbierto, ArchivoV1 } from "../lib/backupreader-crypto";
import { prepararAudio } from "../lib/audio/opusFallback";


/**
 * Resultado de resolver un archivo mencionado en el chat.
 *
 * `revocar` distingue los dos caminos: en v1 la URL es de Storage y vive sola;
 * en v2 es un object URL de una pieza descifrada y hay que revocarlo, o cada
 * foto que se mira se queda en memoria para siempre.
 */
export type MediaResuelta =
  | { estado: "ok"; url: string; revocar: boolean }
  | { estado: "demasiado-grande" }
  | { estado: "no-encontrada" };

/** Progreso de una migración v1 → v2 en curso. */
export type EstadoMigracion = {
  fullPath: string;
  fase: "listando" | "cifrando" | "verificando" | "borrando";
  hechas: number;
  total: number;
};

type StorageContextProps = {
  saveFile: (file: File) => void;
  deleteFile: (uid: string) => void;
  getFiles: (firestoreId: string) => void;
  getAsset: (fullpath: string) => Promise<string>;
  getMediaUrl: (nombreArchivo: string) => Promise<MediaResuelta>;
  getFile: (fullpath: string, chatName: string) => void;
  fetchBucketSize: () => Promise<number>;
  /** Cifra un backup v1 y, si todo cuadra, borra el original. */
  migrarBackup: (fullPath: string, chatName: string) => Promise<void>;
  /** Progreso de la migración en curso, o null si no hay ninguna. */
  migracion: EstadoMigracion | null;
  chat: Chat[] | null;
  errorMessage: string;
  progress: number;
  chatName: string | null;
  fullPath: string | null;
  assetUrl: string | null;
  file: FileDetail[] | null;
  fileList: FileList[] | null;
  recentFileName: string | null;
  uploadStatus: "saving" | "saved" | "not-saved" | null;
  downloadFileStatus: "downloading" | "downloaded" | "not-downloaded" | null;
  downloadFilesStatus: "downloading" | "downloaded" | "not-downloaded" | null;
};

export const StorageInitialState: StorageState = {
  file: null,
  chat: null,
  fileList: [],
  chatName: null,
  fullPath: null,
  assetUrl: '',
  progress: 0,
  fileName: null,
  errorMessage: "",
  uploadStatus: null,
  recentFileName: null,
  downloadFileStatus: null,
  downloadFilesStatus: null,
};

export const StorageContext = createContext({} as StorageContextProps);

export const StorageProvider = ({ children }: any) => {
  /* `updateStorageSizeUser` ya no se usa aquí: el tamaño ocupado sale ahora de
     `cipherBytes` en el documento de cada backup (config/backupRepo.ts), que sí
     está acotado por las reglas. */
  const { user } = useContext(FirestoreContext);
  const { dek, status: estadoBoveda } = useContext(VaultContext);
  const [state, dispatch] = useReducer(storageReducer, StorageInitialState);
  const [migracion, setMigracion] = useState<EstadoMigracion | null>(null);
  const { setLoading } = useLoading();


 
/**
 * Convierte el texto crudo de un export de WhatsApp en filas
 * [fecha, remitente, mensaje].
 *
 * Antes esto vivía dentro de una función que además descargaba el archivo por
 * XHR. Se separó en la Etapa 6 porque con E2EE el texto ya no llega de una URL,
 * sino de descifrar una pieza: cambia de dónde vienen los bytes, no cómo se
 * parsean. Toda la lógica de abajo (los dos formatos, iOS y Android) es la
 * misma de siempre.
 */
const parsearTextoChat = (result: string): string[][] => {

  // Regular expression pattern for date and time stamps
  const pattern = /\[\d{1,2}\/\d{1,2}\/\d{2,4}(, | )\d{1,2}:\d{2}:\d{2}( [AP]M)?\]|\[\d{1,2}\/\d{1,2}\/\d{2,4} \d{1,2}:\d{2}:\d{2}\]|\d{1,2}\/\d{1,2}\/\d{2,4}(, | )\d{1,2}:\d{2}( [ap]\. m\.|)/g;

  const dateIndices = [];
  

  type MessagePart = string;
  type Message = MessagePart[];
  const messages: string[] = [];
  

  let match;

  if (typeof result === 'string') {
    while ((match = pattern.exec(result)) !== null) {
      dateIndices.push(match.index);
    }
    for (let i = 0; i < dateIndices.length; i++) {
        const start = dateIndices[i];
        let end = i < dateIndices.length - 1 ? dateIndices[i + 1] : result.length;
        
        // Trim trailing characters that are not part of the next date stamp
        const conversationSegment = result.substring(start, end).trim();
        const lastIndex = conversationSegment.lastIndexOf('[');
        const cleanSegment = lastIndex > 0 ? conversationSegment.substring(0, lastIndex) : conversationSegment;
        messages.push(cleanSegment.trim());
    }
  }else{
    console.log('it is not a string...')
  }

  
  const cleanedMessages = messages.map(message => 
    message
        .replace(/\u200E/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
  );

 
  const dataFormatted = cleanedMessages?.map((i) =>
    i.split(/(.*?)\](.*?)\:/).filter((i) => {
      return i != "";
    })
  );

  function findDateInString(inputString: string): string {
    // Updated regex to match both yyyy-mm-dd and m/d/yy formats.
    // The new pattern is added to capture dates in the "m/d/yy" and "d/m/yy" formats.
    const dateRegex = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b|(\b\d{1,2}\/\d{1,2}\/\d{2}\b)/;
    const match = inputString.match(dateRegex);
    if (match) {
      return match[0];
    }
    return "";
  }
  

  function findHourInString(inputString: string): string {
    // Regular expression for matching hours in 24-hour format (HH:mm) or 12-hour format (hh:mm AM/PM)
    const hourRegex = /\b((?:[01]?\d|2[0-3]):[0-5]\d\b)|(?:\b(1[0-2]|0?\d):[0-5]\d\s?(AM|PM))\b/i;
    const match = inputString.match(hourRegex);
    return match ? match[0] : "";
  }

  // Parser robusto para dos formatos de exportación de WhatsApp:
  //   Android:  "9/8/26 08:10 - Nombre: mensaje"
  //   iOS:      "[9/8/26, 08:10:00] Nombre: mensaje"
  function parseSegment(rawSeg: string): string[] {
    const seg = (rawSeg || "")
      .replace(/\u200E/g, "")
      .replace(/[\u200B-\u200D\uFEFF\u200F]/g, "");

    const dateTime = `${findDateInString(seg)} ${findHourInString(seg)}`.trim();

    // Quitar el prefijo de fecha/hora hasta el separador del nombre.
    let rest = seg;
    if (rest.trimStart().startsWith("[")) {
      // iOS: cortar tras el primer "]"
      const close = rest.indexOf("]");
      if (close !== -1) rest = rest.slice(close + 1);
    } else {
      // Android: cortar tras "HH:MM - " o "HH:MM:SS - "
      const sep = rest.match(/\d{1,2}:\d{2}(?::\d{2})?\s*-\s*/);
      if (sep && sep.index !== undefined) {
        rest = rest.slice(sep.index + sep[0].length);
      }
    }
    rest = rest.trim();

    // rest = "Nombre: mensaje"  o un mensaje de sistema (sin "Nombre:")
    let name = "";
    let content = rest;
    const colon = rest.indexOf(":");
    if (colon !== -1) {
      const candidate = rest.slice(0, colon).trim();
      // Un nombre real es corto y no tiene saltos de línea.
      if (candidate.length > 0 && candidate.length <= 60 && !candidate.includes("\n")) {
        name = candidate;
        content = rest.slice(colon + 1).trim();
      }
    }

    return [dateTime, name, content];
  }

  function processMessages(messages: string[]): string[][] {
    return messages.map(parseSegment);
  }

  const processedMessages = processMessages(messages);

  return processedMessages;
};

/** Camino v1: el texto llega de una URL de descarga. */
const formatingTxtFile = (url: string) => {
  fetch(url)
    .then((r) => r.text())
    .then((texto) => {
      dispatch({ type: "chatFile", payload: parsearTextoChat(texto) });
    })
    .catch((error) => {
      console.error("No se pudo leer el texto del chat:", error);
      dispatch({ type: "downloadingFileError", payload: "Error-getting-file" });
    });
};



  
  

  interface IMessage {
    timestamp_ms: number;
    sender_name: string;
    content: string;
    share: {
        link: string;
    };
    photos:Array<{
        uri: string;
        creation_timestamp: number;
    }>;
}

  interface IJsonStructure {
      messages: IMessage[];
  }

  


async function formatingJsonFile(url: string): Promise<void> {
    try {
        const response: AxiosResponse<ArrayBuffer> = await axios.get(url, { responseType: 'arraybuffer' });
        const utf8Decoder = new TextDecoder('utf-8');
        const decodedString: string = utf8Decoder.decode(response.data);

        const jsonData: IJsonStructure = JSON.parse(decodedString);

        const formattedMessages: string[][] = jsonData.messages.map((message: IMessage) => {

            const mDate = new Date(message.timestamp_ms).toISOString();
            const mSender = utf8.decode(message.sender_name);
            //const mContent = message.content ? (utf8.decode(message.content) + (message.share && message.share.link ? ' ' + message.share.link : '')) : (message.share && message.share.link ? message.share.link : "");
            let mContent = message.content ? utf8.decode(message.content) : '';
            if (message.share && message.share.link) {
                mContent += (mContent ? ' ' : '') + message.share.link;
            }
            if (message.photos && message.photos.length > 0) {
                const photoUris = message.photos.map(photo => photo.uri).join(' ');
                mContent += (mContent ? ' ' : '') + photoUris;
            }

            const mShare = message.share ? message.share.link : "";

            return [
                `${mDate}`, `${mSender}`, `${mContent}` , `${mShare}`
            ];
        });

        if (formattedMessages.length > 0) {
            dispatch({
                type: "chatFile",
                payload: formattedMessages,
            });
        }
    } catch (error) {
        console.error("An error occurred in the formatingJsonFile function:", error);
        throw error;
    }
}

/** Mismo parseo de Instagram, pero partiendo del texto ya en memoria (v2). */
function parsearJsonInstagram(texto: string): string[][] {
    const jsonData: IJsonStructure = JSON.parse(texto);
    return jsonData.messages.map((message: IMessage) => {
        const mDate = new Date(message.timestamp_ms).toISOString();
        const mSender = utf8.decode(message.sender_name);
        let mContent = message.content ? utf8.decode(message.content) : '';
        if (message.share && message.share.link) {
            mContent += (mContent ? ' ' : '') + message.share.link;
        }
        if (message.photos && message.photos.length > 0) {
            mContent += (mContent ? ' ' : '') + message.photos.map(p => p.uri).join(' ');
        }
        const mShare = message.share ? message.share.link : "";
        return [`${mDate}`, `${mSender}`, `${mContent}`, `${mShare}`];
    });
}





  async function fetchBucketSize(): Promise<number> {
    
    const bucketURL = "gs://backup-reader.appspot.com/";
    const folderPathWs =  "backups/" + user?.uid + "/whatsapp"; 
  
    const url: string = `https://us-central1-backup-reader.cloudfunctions.net/bucketSizeFunction?bucketName=${bucketURL}&folderPath=${folderPathWs}`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
      const bucketSizeMb: number = Number(data.size.toFixed(2));
      return bucketSizeMb;
    } catch (error) {
      console.error('Error fetching bucket size:', error);
      throw error;
    }
  }
  
  

  // -------------------------------------------------------------------------
  // Lectura de backups cifrados (Etapa 6)
  // -------------------------------------------------------------------------

  /**
   * Descarga un objeto de Storage.
   *
   * `getBlob` y no `getDownloadURL`: el download URL lleva un token que sirve
   * para cualquiera que lo tenga, saltándose las reglas. getBlob va con el
   * token de sesión, así que las reglas sí se aplican.
   */
  const descargar = (ruta: string): Promise<Blob> => getBlob(ref(storage, ruta));

  /**
   * Sube un blob y espera a que termine DE VERDAD, no solo a que arranque.
   *
   * Lo usan la subida normal y la migración: las dos escriben las mismas rutas
   * opacas con el mismo content-type, que es lo único que aceptan las reglas.
   */
  const subir = (ruta: string, blob: Blob) =>
    new Promise<void>((resolve, reject) => {
      const tarea = uploadBytesResumable(ref(storage, ruta), blob, {
        contentType: BLOB_CONTENT_TYPE,
        cacheControl: BLOB_CACHE_CONTROL,
      });
      tarea.on("state_changed", undefined, reject, () => resolve());
    });

  /**
   * Manifiestos ya descifrados en esta sesión, por backupId.
   *
   * Se cachean porque la barra lateral necesita el nombre de CADA backup, y
   * ese nombre solo existe dentro del manifiesto cifrado. Sin caché, abrir el
   * dashboard descargaría y descifraría todos los manifiestos cada vez.
   */
  const backupsAbiertos = useRef<Map<string, BackupAbierto>>(new Map());

  /* Al bloquear la bóveda o cerrar sesión, la caché se tira: contiene nombres
     de chats y de archivos en claro.

     Y al desbloquear hay que releer la lista: `getFiles` corre al iniciar
     sesión, cuando la bóveda todavía está bloqueada y los backups cifrados no
     se pueden nombrar. Sin esto, la barra lateral se queda vacía hasta la
     siguiente recarga. */
  useEffect(() => {
    if (!dek) {
      backupsAbiertos.current.clear();
      return;
    }
    if (user?.uid) void getFiles(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dek, user?.uid]);

  const obtenerBackup = async (backupId: string): Promise<BackupAbierto | null> => {
    if (!user?.uid || !dek) return null;
    const cacheado = backupsAbiertos.current.get(backupId);
    if (cacheado) return cacheado;
    const abierto = await abrirBackup(user.uid, backupId, dek, descargar);
    backupsAbiertos.current.set(backupId, abierto);
    return abierto;
  };

  /**
   * Lista los backups cifrados para la barra lateral.
   *
   * Requiere la bóveda desbloqueada: los nombres viven dentro del manifiesto,
   * así que con la bóveda bloqueada no hay nada que mostrar. Eso es el precio
   * de no filtrar con quién chatea el usuario.
   */
  const listarCifrados = async (uid: string): Promise<FileList[]> => {
    if (!dek) return [];
    const docs = await listarBackups(uid);
    const salida: FileList[] = [];
    for (const d of docs) {
      try {
        const abierto = await obtenerBackup(d.backupId);
        if (abierto) {
          salida.push({
            name: abierto.manifest.name,
            fullPath: handleDeBackup(d.backupId),
            cifrado: true,
          });
        }
      } catch (error) {
        /* Un backup ilegible (subida a medias, formato futuro) no debe tumbar
           la lista entera: se omite y se sigue con los demás. */
        console.warn("No se pudo abrir el backup", d.backupId, error);
      }
    }
    return salida;
  };

  // -------------------------------------------------------------------------
  // Migración de backups v1 (Etapa 8)
  // -------------------------------------------------------------------------

  /**
   * Lista TODOS los archivos bajo un prefijo de Storage, recursivamente.
   *
   * `list()` devuelve como mucho 1000 entradas por página. El resto del código
   * v1 nunca siguió el `nextPageToken`, así que en un backup grande veía una
   * parte y creía que era el todo. Para pintar una barra lateral eso solo
   * significaba que faltaban carpetas; para migrar significaría copiar 1000
   * archivos de 4000 y borrar el original. Aquí se pagina de verdad.
   *
   * Los subprefijos se juntan en un Set antes de recorrerlos porque pueden
   * repetirse entre páginas.
   */
  const listarArchivosV1 = async (prefijo: string): Promise<ArchivoV1[]> => {
    const base = prefijo.replace(/\/+$/, "");
    const salida: ArchivoV1[] = [];

    const recorrer = async (ruta: string): Promise<void> => {
      const subcarpetas = new Set<string>();
      let pageToken: string | undefined = undefined;

      do {
        const pagina = await list(ref(storage, ruta), { maxResults: 1000, pageToken });
        for (const item of pagina.items) {
          salida.push({
            ruta: item.fullPath,
            // Nombre relativo a la carpeta del backup: es lo que va al manifiesto.
            nombre: item.fullPath.startsWith(base + "/")
              ? item.fullPath.slice(base.length + 1)
              : item.name,
          });
        }
        for (const sub of pagina.prefixes) subcarpetas.add(sub.fullPath);
        pageToken = pagina.nextPageToken ?? undefined;
      } while (pageToken);

      for (const sub of subcarpetas) await recorrer(sub);
    };

    await recorrer(base);
    return salida;
  };

  /**
   * Cifra un backup v1 y, solo si la copia se puede volver a leer, borra el
   * original.
   *
   * El orden es lo importante:
   *
   *   1. Listar (paginado) y comprobar que hay texto de chat.
   *   2. Cifrar y subir piezas + manifiesto, con un backupId NUEVO.
   *   3. Verificar releyendo el manifiesto y el chat DESDE STORAGE.
   *   4. Registrar en Firestore —recién ahora aparece en la lista—.
   *   5. Borrar el v1, y solo si no quedó ninguna pieza sin cifrar.
   *
   * Si algo falla en 1–3, el v1 sigue intacto y el usuario no ve nada nuevo:
   * lo que queda en Storage son blobs huérfanos. Si falla en 5, el usuario
   * acaba con el chat duplicado, que es molesto pero no destructivo.
   */
  const migrarBackup = async (fullPath: string, chatName: string) => {
    if (!user?.uid || !dek) {
      dispatch({
        type: "uploadingError",
        payload: estadoBoveda === "none" ? "vault-not-created" : "vault-locked",
      });
      return;
    }
    if (esHandleV2(fullPath)) return; // ya está cifrado
    if (migracion) return; // una a la vez: cifrar es caro en CPU y memoria

    const uid = user.uid;
    const backupId = newId();

    try {
      setMigracion({ fullPath, fase: "listando", hechas: 0, total: 0 });
      const archivos = await listarArchivosV1(fullPath);

      if (!archivos.length || !tieneTextoDeChat(archivos)) {
        throw new Error("la carpeta no contiene un chat legible");
      }

      setMigracion({ fullPath, fase: "cifrando", hechas: 0, total: archivos.length });

      const { manifest, omitidas } = await migrarBackupV1(
        archivos,
        dek,
        chatName || nombreDesdeCarpeta(fullPath),
        descargar,
        {
          backupId,
          source: origenDeRuta(fullPath),
          subirPieza: (id, blob) => subir(piecePath(uid, backupId, id), blob),
          subirManifiesto: (blob) => subir(manifestPath(uid, backupId), blob),
          onProgreso: (hechas, total) =>
            setMigracion({ fullPath, fase: "cifrando", hechas, total }),
          onOmitida: (nombre, motivo) =>
            console.warn(`Pieza omitida al migrar: ${nombre} (${motivo})`),
        }
      );

      /* Verificar ANTES de registrar: si la copia salió mal, el backup roto ni
         siquiera llega a aparecer en la barra lateral. */
      setMigracion({ fullPath, fase: "verificando", hechas: 0, total: 0 });
      await verificarMigracion(uid, backupId, dek, descargar, manifest.pieces.length);

      await registrarBackup(uid, backupId, {
        pieceCount: manifest.pieces.length,
        cipherBytes: cipherBytes(manifest),
        fmt: FORMAT_VERSION,
      });

      if (omitidas.length) {
        /* Con piezas sin cifrar, el original es la única copia de esos
           archivos. Se deja donde está y se avisa; borrarlo sería perderlos. */
        console.warn(
          `${omitidas.length} pieza(s) no se pudieron cifrar; se conserva el backup original`,
          omitidas
        );
      } else {
        setMigracion({ fullPath, fase: "borrando", hechas: 0, total: archivos.length });
        let borradas = 0;
        for (const archivo of archivos) {
          try {
            await deleteObject(ref(storage, archivo.ruta));
          } catch (error) {
            /* Un borrado fallido no revierte nada: la copia cifrada ya está
               verificada. Peor caso, quedan restos en texto plano que se
               pueden barrer a mano. */
            console.warn("No se pudo borrar", archivo.ruta, error);
          }
          setMigracion({
            fullPath,
            fase: "borrando",
            hechas: ++borradas,
            total: archivos.length,
          });
        }
      }

      await getFiles(uid);
    } catch (error) {
      console.error("No se pudo migrar el backup:", fullPath, error);
      dispatch({ type: "downloadingFileError", payload: "Error-migrating-file" });
    } finally {
      setMigracion(null);
    }
  };

  /** Abre un chat cifrado: descifra el manifiesto, la pieza de chat, y parsea. */
  const abrirChatCifrado = async (handle: string, chatName: string) => {
    const backupId = backupIdDeHandle(handle);
    if (!backupId || !user?.uid || !dek) return;

    dispatch({ type: "chatFile", payload: null });
    dispatch({ type: "fileDownloaded", payload: { file: [] } });
    dispatch({ type: "setRecentFileName", payload: null });
    setLoading(true);

    try {
      const abierto = await obtenerBackup(backupId);
      if (!abierto) throw new Error("no se pudo abrir el backup");

      const chat = await leerTextoDelChat(user.uid, abierto, dek, descargar);
      if (!chat) throw new Error("el backup no tiene pieza de chat");

      const esJson =
        abierto.manifest.source === "instagram" ||
        chat.nombre.toLowerCase().endsWith(".json");

      dispatch({
        type: "chatFile",
        payload: esJson ? parsearJsonInstagram(chat.texto) : parsearTextoChat(chat.texto),
      });
      dispatch({ type: "setChatName", payload: chatName || abierto.manifest.name });
      dispatch({ type: "setFullPath", payload: handle });
    } catch (error) {
      console.error("No se pudo abrir el chat cifrado:", error);
      dispatch({ type: "downloadingFileError", payload: "Error-getting-file" });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resuelve un archivo mencionado en el texto del chat a una URL usable.
   *
   * Esto es lo que sustituye al antiguo `getAsset(ruta + '/' + nombre)`: con
   * nombres opacos ya no se puede armar la ruta, hay que preguntarle al
   * manifiesto.
   */
  const getMediaUrl = async (nombreArchivo: string): Promise<MediaResuelta> => {
    const handle = state.fullPath;
    if (!handle || !nombreArchivo) return { estado: "no-encontrada" };

    // --- v1: se arma la ruta y se pide la URL de descarga, como siempre ---
    if (!esHandleV2(handle)) {
      /* Los exports de Instagram cuelgan la media de la raíz del backup, no de
         la carpeta del chat. */
      const base = handle.includes("/your_instagram_activity/")
        ? handle.slice(0, handle.indexOf("/your_instagram_activity/"))
        : handle;

      /* En v1 los audios .opus los convertía a .mp3 la Cloud Function, así que
         el archivo que existe en Storage tiene otra extensión que la que
         aparece en el texto del chat. En v2 no: el .opus se guarda tal cual y
         se reproduce nativo (o con el decodificador de la Etapa 7). */
      let nombre = nombreArchivo.replace(/[\W_]+$/, "");
      if (nombre.toLowerCase().endsWith(".opus")) {
        nombre = nombre.slice(0, -5) + ".mp3";
      }

      try {
        const url = await getAsset(base + "/" + nombre);
        return { estado: "ok", url, revocar: false };
      } catch {
        return { estado: "no-encontrada" };
      }
    }

    // --- v2: el manifiesto dice qué pieza descargar ---
    const backupId = backupIdDeHandle(handle);
    if (!backupId || !user?.uid || !dek) return { estado: "no-encontrada" };

    try {
      const abierto = await obtenerBackup(backupId);
      if (!abierto) return { estado: "no-encontrada" };
      const r = await resolverMedia(user.uid, abierto, nombreArchivo, dek, descargar, {
        /* Respaldo de Opus (Etapa 7): en los navegadores que no saben
           reproducir Ogg Opus —Safari por debajo de la 18.4— el audio se
           convierte a WAV antes de llegar al <audio>. En los demás no se
           carga nada. */
        transformar: (blob, pieza) => prepararAudio(blob, pieza.mime, pieza.name),
      });
      if (r.estado === "ok") return { estado: "ok", url: r.objectUrl, revocar: true };
      if (r.estado === "demasiado-grande") return { estado: "demasiado-grande" };
      return { estado: "no-encontrada" };
    } catch (error) {
      console.warn("No se pudo descifrar la media:", nombreArchivo, error);
      return { estado: "no-encontrada" };
    }
  };

  /**
   * Sube un backup CIFRADO en el navegador.
   *
   * Cambio de fondo respecto de la versión anterior: el zip ya no se sube tal
   * cual para que el servidor lo descomprima. Ahora se descomprime y se cifra
   * aquí, y al servidor solo suben blobs opacos con nombres aleatorios.
   *
   * Requiere la bóveda desbloqueada: sin la DEK no hay con qué cifrar.
   */
  const saveFile = async (file: File) => {
    if (!user?.uid) return;

    if (!dek) {
      dispatch({
        type: "uploadingError",
        payload: estadoBoveda === "none" ? "vault-not-created" : "vault-locked",
      });
      return;
    }

    dispatch({ type: "chatFile", payload: [] });
    dispatch({ type: "loadingFile" });
    dispatch({ type: "fileUploaded", payload: "saving" });

    const uid = user.uid;

    /* El id se genera AQUÍ, antes de empezar: las rutas de Storage lo necesitan
       dentro de `subirPieza`, que corre mientras `uploadBackup` todavía no ha
       devuelto nada. Leerlo del resultado dejaba las piezas en
       `backups/{uid}/undefined/`. */
    const backupId = newId();

    try {
      const { manifest, omitidas } = await uploadBackup(
        file,
        dek,
        file.name,
        {
          backupId,

          /* Cada pieza es un blob opaco: nombre aleatorio, sin extensión y con
             content-type genérico. Ese content-type además evita que la Cloud
             Function `unzip` se dispare, sin tener que desplegar nada. */
          subirPieza: (id, blob) => subir(piecePath(uid, backupId, id), blob),

          subirManifiesto: (blob) => subir(manifestPath(uid, backupId), blob),

          /* El progreso cuenta PIEZAS cifradas, no bytes subidos: cifrado y
             subida van encadenados, así que refleja mejor el avance real. */
          onProgreso: (pct) => dispatch({ type: "setProgress", payload: pct }),

          onOmitida: (name, motivo) =>
            console.warn(`Pieza omitida: ${name} (${motivo})`),
        }
      );

      /* El documento de Firestore se escribe AL FINAL, a propósito: si algo
         falla antes, el backup no aparece en la lista en vez de aparecer roto.
         Lo que quede en Storage son blobs huérfanos. */
      await registrarBackup(uid, backupId, {
        pieceCount: manifest.pieces.length,
        cipherBytes: cipherBytes(manifest),
        fmt: FORMAT_VERSION,
      });

      dispatch({ type: "setProgress", payload: 0 });
      dispatch({ type: "fileUploaded", payload: "saved" });

      /* Refrescar la barra lateral para que el backup recién subido aparezca.
         Antes de la Etapa 6 esto lo disparaba el listener de `userStatus`, que
         escribía la Cloud Function al terminar de descomprimir. Al retirar esa
         función hay que pedirlo explícitamente: ahora el cliente es el único
         que sabe cuándo terminó. */
      await getFiles(uid);

      if (omitidas.length) {
        console.warn(`${omitidas.length} pieza(s) no se cifraron`, omitidas);
      }

      setTimeout(() => {
        dispatch({ type: "fileUploaded", payload: null });
      }, 4000);
    } catch (error) {
      console.error("Error subiendo el backup cifrado:", error);
      dispatch({ type: "setProgress", payload: 0 });
      dispatch({ type: "uploadingError", payload: "Error-uploading-file" });
    }
  };

  const getUrl = async (starsRef: StorageReference, name: string) => {
    let resp: FileDetail = { url: "", name: "" };
    await getDownloadURL(starsRef)
      .then((url) => {

        if (name.endsWith(".txt")) {
            formatingTxtFile(url);
        } else if (name.endsWith(".json")) {
            formatingJsonFile(url);
        }
      
        resp.url = url;
        resp.name = name;

      })
      .catch((error) => {
        console.log(error);
      });
    return resp;
  };


  const cleanString = (input: string): string => {
    // Regular expression to match invisible Unicode characters like U+200E
    const regExp = /[\u200B-\u200D\uFEFF\u200E\u200F]/g;
    return input.replace(regExp, '');
  };


  /*
    Retrieves an asset from the lazy loading mechanism
  */
    const getAsset = async (assetName: string): Promise<string> => {
      try {
          const bucketURL = "gs://backup-reader.appspot.com/";
          const completeUrl = cleanString(bucketURL + assetName.replace(/\/\s+/g, '/').trimEnd());
          const refFinal = ref(storage, completeUrl);
          const urlFinal = await getDownloadURL(refFinal);
  
          return urlFinal;
      } catch (error) {
          console.error(error);
          dispatch({
              type: "downloadingFileError",
              payload: "Error-getting-file",
          });
  
          // You might want to return something or rethrow the error here
          throw error; // or return a default value like an empty string
      }
  };
  




  /*
    It gets trigger when the user clicks on a conversation present on the sidebar.
  */
  const getFile = async (fullpath: string, chatName: string) => {

    /* Único punto donde se bifurca v1 / v2. Mientras esto no se filtre a los
       componentes, la convivencia se mantiene barata (ver Etapa 8). */
    if (esHandleV2(fullpath)) {
      return abrirChatCifrado(fullpath, chatName);
    }

    try {
      let fileDetail: FileDetail[] = [];
      const bucketURL = "gs://backup-reader.appspot.com/";

      /*
        Restarting the state due to inconsistencies in the Lazy loading implementation with previous data selection.
      */
      dispatch({type: "chatFile",payload: null});
      dispatch({ type: "fileDownloaded", payload: { file: [] } });  // Use an empty array instead of null
      dispatch({ type: "setRecentFileName", payload: null });
      dispatch({ type: "setChatName", payload: null });
      dispatch({ type: "setFullPath", payload: null });

      
      // Function to list files and get their URLs
      setLoading(true);
      const processFiles = async (path: string) => {
        const listRef = ref(storage, path);
        const allResults = await list(listRef);
        
        for (const item of allResults.items) {
          if (item.name.endsWith('.txt') || item.name.endsWith('.json')) {
            const reference = bucketURL + item.fullPath;
            const starsRef = ref(storage, reference);
            const url = await getUrl(starsRef, item.name);
            fileDetail.push(url);
            break;
          }
        }
      };
  
      // Process files in the main directory
      await processFiles(fullpath);

      setLoading(false);

      // Dispatch the final file details
      dispatch({
        type: "fileDownloaded",
        payload: {
          file: fileDetail,
        },
      });
      dispatch({
        type: "setRecentFileName",
        payload: null,
      });
      dispatch({
        type: "setChatName",
        payload: chatName
      });
      dispatch({
        type: "setFullPath",
        payload: fullpath
      });
  
    } catch (error) {
      console.log(error);
      dispatch({
        type: "downloadingFileError",
        payload: "Error-getting-file",
      });
    }
  };
  

  const deleteFile = async (fullpath: string) => {
    const desertRef = ref(storage, fullpath);
    await deleteObject(desertRef)
      .then(() => {
        console.log("reload");
      })
      .catch((error) => {
        console.log(error);
      });
  };

  /**
   * Carpetas donde la Cloud Function `unzip` dejaba los backups en texto plano.
   *
   * "other" estaba sin listar: `detectarOrigen` devolvía "other" para cualquier
   * zip cuyo nombre no dijera WhatsApp ni Instagram, y esos backups acababan
   * ahí. Como `getFiles` solo preguntaba por las otras dos, quedaban en el
   * servidor sin que el usuario pudiera verlos, abrirlos ni borrarlos.
   */
  const CARPETAS_V1 = ["whatsapp", "instagram", "other"] as const;

  const getFilesFromDirectory = async (firestoreId: string, directory: string) => {
    const listRef = ref(storage, "backups/" + firestoreId + "/" + directory);

    /* Paginado: `list()` devuelve como mucho 1000 entradas y el código anterior
       no seguía el nextPageToken, así que un usuario con muchos backups veía
       solo una parte. */
    const fileList: FileList[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const pagina = await list(listRef, { maxResults: 1000, pageToken });
      for (const item of pagina.prefixes) {
        fileList.push({ name: item.name, fullPath: item.fullPath, cifrado: false });
      }
      pageToken = pagina.nextPageToken ?? undefined;
    } while (pageToken);

    return { fileList };
  };

const getFiles = async (firestoreId: string) => {
    try {
        dispatch({
            type: "setChatName",
            payload: null,
        });
        dispatch({
            type: "chatFile",
            payload: null,
        });
        dispatch({
            type: "downloadingFiles",
        });

        /* v1: los backups en texto plano se siguen descubriendo listando
           Storage. Las TRES carpetas, incluida "other", que hasta ahora se
           quedaba fuera. */
        const enTextoPlano: FileList[] = [];
        for (const carpeta of CARPETAS_V1) {
            const r = await getFilesFromDirectory(firestoreId, carpeta);
            enTextoPlano.push(...r.fileList);
        }

        /* v2: los cifrados no tienen nombres que listar, así que salen de
           Firestore y de descifrar cada manifiesto. Si la bóveda está
           bloqueada, `listarCifrados` devuelve vacío y solo se ven los v1. */
        const cifrados = await listarCifrados(firestoreId);

        /* Los cifrados van primero: son los más recientes y los únicos que se
           siguen creando. */
        const aggregatedFileList = [...cifrados, ...enTextoPlano];

        dispatch({
            type: "fileListDownloaded",
            payload: { fileList: aggregatedFileList },
        });
    } catch (error) {
        dispatch({
            type: "downloadingFilesError",
            payload: "error-getting-file-List",
        });
        console.log(error);
    }
};



  return (
    <StorageContext.Provider
      value={{
        ...state,
        saveFile,
        getAsset,
        getMediaUrl,
        getFiles,
        getFile,
        deleteFile,
        fetchBucketSize,
        migrarBackup,
        migracion,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};