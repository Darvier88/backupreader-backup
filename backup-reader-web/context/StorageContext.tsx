import axios, { AxiosResponse } from 'axios';
import utf8 from 'utf8';
import { createContext, useReducer, useContext } from "react";

import {
  ref,
  list,
  deleteObject,
  getDownloadURL,
  uploadBytesResumable,
  StorageReference,
} from "firebase/storage";

import { storage } from "../config/firebase";
import { FirestoreContext } from "./FirestoreContext";
import { Chat, FileDetail, FileList } from "../models/Files";
import { storageReducer, StorageState } from "./StorageReducer";
import { useLoading } from "../context/LoadingContext";


type StorageContextProps = {
  saveFile: (file: File) => void;
  deleteFile: (uid: string) => void;
  getFiles: (firestoreId: string) => void;
  getAsset: (fullpath: string) => Promise<string>;
  getFile: (fullpath: string, chatName: string) => void;
  fetchBucketSize: () => Promise<number>;
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
  const { user, updateStorageSizeUser } = useContext(FirestoreContext);
  const [state, dispatch] = useReducer(storageReducer, StorageInitialState);
  const { setLoading } = useLoading();


 
const formatingTxtFile = (url:string) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.onload = () => {
      const blob = xhr.response;
      let reader = new FileReader();
      reader.onload = (evt) => {
        if (!evt.target) return;
        const result = evt.target.result;

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

        if (dataFormatted) {
          dispatch({
            type: "chatFile",
            payload: processedMessages,
          });
        }


      };
      reader.readAsText(blob);
    };
    xhr.open("GET", url);
    xhr.send();
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
  
  

  const saveFile = async (file: File) => {
    dispatch({
      type: "chatFile",
      payload: [],
    });
    dispatch({
      type: "loadingFile",
    });

    try {
      const fileSizeMb = file.size / 1000000;
      const completeFileName = file.name;

      let socialmediaChannel: string;
      if (completeFileName.includes("WhatsApp")) {
        socialmediaChannel = "whatsapp";
      } else if (completeFileName.includes("instagram")) {
        socialmediaChannel = "instagram";
      } else {
        socialmediaChannel = "other";
      }

      const storageRef = ref(
        storage,
        `backups/${user?.uid}/${socialmediaChannel}/${file.name}`
      );

      // El content-type es obligatorio: la Cloud Function `unzip` solo procesa
      // objetos con contentType === "application/zip".
      const metadata = { contentType: "application/zip" };

      // Una única subida resumable (soporta progreso y no duplica el archivo).
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          dispatch({
            type: "setProgress",
            payload: progress,
          });
        },
        (error) => {
          console.error("Error subiendo el archivo:", error);
          dispatch({
            type: "uploadingError",
            payload: "Error-uploading-file",
          });
        },
        async () => {
          // Subida completada con éxito.
          dispatch({
            type: "setProgress",
            payload: 0,
          });

          // Actualizar el tamaño ocupado por el usuario, una sola vez y al final.
          if (user?.uid && user?.storageSize != null) {
            const size = user.storageSize + fileSizeMb;
            try {
              await updateStorageSizeUser(user.uid, size);
            } catch (e) {
              console.error("No se pudo actualizar storageSize:", e);
            }
          }

          dispatch({
            type: "fileUploaded",
            payload: "saved",
          });
          setTimeout(() => {
            dispatch({
              type: "fileUploaded",
              payload: null,
            });
          }, 4000);
        }
      );
    } catch (error) {
      console.log(error);
      dispatch({
        type: "uploadingError",
        payload: "Error-uploading-file",
      });
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

  const getFilesFromDirectory = async (firestoreId: string, directory: string) => {
    const listRef = ref(storage, "backups/" + firestoreId + "/" + directory);
    const allResults = await list(listRef);
    
    const uloadedFileName = allResults.items
        .map((i) => i.name.replace("WhatsApp Chat - ", "").slice(0, -4))
        .toString();
    
    let fileList: FileList[] = [];
    allResults.prefixes.forEach((item) => {
        fileList.push({ name: item.name, fullPath: item.fullPath });
    });

    return { uloadedFileName, fileList };
}

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

        const whatsappResults = await getFilesFromDirectory(firestoreId, "whatsapp");
        const instagramResults = await getFilesFromDirectory(firestoreId, "instagram");
        
        const aggregatedFileList = [...whatsappResults.fileList, ...instagramResults.fileList];

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
        getFiles,
        getFile,
        deleteFile,
        fetchBucketSize,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};