import { FC, useContext, useRef, useEffect, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Button, Typography } from "@mui/material";

import { BlockButton } from "../buttons";
import { StorageContext } from "../../context/StorageContext";
import { FirestoreContext } from "../../context/FirestoreContext";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import JSZip from 'jszip';


declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

import {
  IconButton,
  Theme,
  useMediaQuery
} from "@mui/material";
import { textTransforms } from "@nextui-org/react";

const styles = {
  container: {
    width: "100%",
    marginTop: 20,
    display: "flex",
    alignItems: "center",
  },
  title: {
    marginTop: 10,
    color: "#3C3C3C",
    letterSpacing: 0.5,
  },
  text: {
    marginTop: 1,
    color: "#3C3C3C",
    letterSpacing: 0.5,
  },
};

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

type ManageFileCardProps = {
  isFirstFile: boolean;
  chat: boolean;
};


export const ManageFileCard: FC<ManageFileCardProps> = ({ isFirstFile, chat }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { saveFile } = useContext(StorageContext);
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const hiddenFileInput2 = useRef<HTMLInputElement>(null);
  const { user } = useContext(FirestoreContext);

  const [isGooglePickerApiLoaded, setIsGooglePickerApiLoaded] = useState<boolean>(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  let tokenClient: any;
  let accessToken: string | null = null;


  useEffect(()=>{
    const isAndroid = (): boolean => {
      if (typeof navigator !== 'undefined') {
        return /Android/i.test(navigator.userAgent);
      }
      return false;
    };
    setIsAndroidDevice(isAndroid());
  },[]);



  useEffect(() => {
    const loadGooglePickerApi = () => {
      window.gapi.load('picker', { callback: onPickerApiLoad });
    };

    const loadGapiAndGis = () => {
      if (!window.gapi) {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = loadGooglePickerApi;
        document.body.appendChild(gapiScript);
      } else if (!isGooglePickerApiLoaded) {
        loadGooglePickerApi();
      }

      if (!window.google || !window.google.accounts) {
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = gisLoaded;
        document.body.appendChild(gisScript);
      }
    };

    loadGapiAndGis();

  }, [isGooglePickerApiLoaded]);

  const onPickerApiLoad = () => {
    setIsGooglePickerApiLoaded(true);
  };

  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: "725189668435-hcnm8nl0qqdutpddcfiqunrldav13qpc.apps.googleusercontent.com",
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response:any) => {
        if (response.error !== undefined) {
          console.error('Error fetching access token:', response);
          return;
        }
        accessToken = response.access_token;
      },
    });

  };

  

  function handleAccessTokenRequest() {

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: "725189668435-hcnm8nl0qqdutpddcfiqunrldav13qpc.apps.googleusercontent.com",
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response:any) => {
        if (response.error !== undefined) {
          console.error('Error fetching access token:', response);
          return;
        }
        
        accessToken = response.access_token;
        const picker = new window.google.picker.PickerBuilder()
          .setAppId("725189668435")
          .addView(window.google.picker.ViewId.DOCS)
          .setOAuthToken(accessToken)
          .setDeveloperKey("AIzaSyA7ZkQCVF5NoDm1D2skaZh918HUKYStIIo")
          .setCallback((data: any)=>{
            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
              const fileId: string = data[google.picker.Response.DOCUMENTS][0].id;
              const fileName: string = data[google.picker.Response.DOCUMENTS][0].name;
              downloadFile(fileId, fileName, accessToken);
            }
          })
          .build();
        picker.setVisible(true);
      },
    });

    if (tokenClient) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      console.error('Token client is not initialized.');
    }
  }


  


  function downloadFile(fileId: string, fileName: string, accessToken: string|null): void {
    const driveFileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
    fetch(driveFileUrl, {
      headers: new Headers({
        'Authorization': 'Bearer ' + accessToken
      })
    })
    .then(response => {
      if (response.ok) {
        return response.blob();
      } else {
        throw new Error('Failed to download file: ' + response.statusText);
      }
    })
    .then(blob => {
      const file = new File([blob], fileName, { type: blob.type });
      
        const dataTransfer = new DataTransfer();

        dataTransfer.items.add(file);
        const fileList = dataTransfer.files;
        onHandleSaveFile(fileList);
    })
    .catch(error => {
      console.error('Error downloading file:', error);
    });
  }


 

  const onHandleSaveFile = async (files: FileList | null) => {
    const maxSize = 200 * 1024 * 1024;
    const zip = new JSZip();

    //alert('file length '+files?.length)
  
    if (!files || files.length === 0) return;
  
    let chatName = 'Nombre del Chat';
  
    if (files.length === 1 && (files[0].type === 'application/zip' || files[0].name.endsWith('.zip'))) {
      const file = files[0];
      if (file.size > maxSize) {
        alert('File size exceeds 200 Megabytes');
        return;
      }
      saveFile(file);
    } else {
      
      let userInput = window.prompt("Please enter a name for the chat:", chatName) || chatName;
      chatName = `WhatsApp ${userInput}`;  // Note the space between "WhatsApp" and the user input
  
      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        totalSize += file.size;

        if (totalSize > maxSize) {
          alert('Total file size exceeds 200 Megabytes');
          return;
        }
        const fileContent = await file.arrayBuffer();
        zip.file(file.name, fileContent);
      }
  
      // Generate zip file and then call saveFile with the new zip
      zip.generateAsync({ type: 'blob' })
        .then((content) => {
          const newZipBlob = new Blob([content], { type: 'application/zip' });
          const newZipFile = new File([newZipBlob], `${chatName}.zip`, { type: 'application/zip' });
          saveFile(newZipFile);
        })
        .catch((error) => {
          alert('Error generating zip file :'+ error)
        });
    }
  };  

  return (
    <>
      {/* Barra "Subir desde" */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "flex-end", margin: phone ? "-8px 0 16px" : "8px 0 24px" }}>
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)" }}>
          {t("Subir desde:")}
        </span>
        <button className="br-btn br-btn-ghost br-btn-sm" onClick={handleAccessTokenRequest}>
          {t("Google Drive")}
        </button>
        {!isAndroidDevice && (
          <>
            <button className="br-btn br-btn-ghost br-btn-sm" onClick={() => hiddenFileInput2.current ? hiddenFileInput2.current.click() : null}>
              {t("Archivos")}
            </button>
            <input aria-label="file Input" hidden ref={hiddenFileInput2} multiple accept=".zip,.rar,.7zip" type="file" onChange={(e) => onHandleSaveFile(e.target.files)} />
          </>
        )}
      </div>

      {/* Estado vacío: tarjeta "Selecciona un chat" */}
      {!chat && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", width: "100%" }}>
          <div className="br-card" style={{ maxWidth: 460, width: "100%", padding: "40px 34px", textAlign: "center" }}>
            <img src="/redesign/upload-a-chat.svg" alt="" style={{ width: "100%", maxWidth: 220, height: 140, objectFit: "contain", margin: "0 auto 18px", display: "block" }} />
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass-600)" }}>
              {isFirstFile ? t("Sin chats aún") : t("Ningún chat seleccionado")}
            </span>
            <h2 style={{ margin: "14px 0 8px", fontFamily: serif, fontWeight: 500, fontSize: 28, letterSpacing: "-0.015em", color: "var(--ink-900)" }}>
              {isFirstFile ? t("Sube un chat") : t("Selecciona un chat")}
            </h2>
            <p style={{ margin: "0 0 26px", fontSize: 15.5, lineHeight: 1.6, color: "var(--slate-700)" }}>
              {t("Elige un backup de la lista, o sube una nueva exportación de chat para leerla aquí.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              {!isAndroidDevice && (
                <button className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={() => hiddenFileInput.current ? hiddenFileInput.current.click() : null}>
                  {t("Subir chat")}
                </button>
              )}
              <input hidden multiple type="file" ref={hiddenFileInput} aria-label="file Input" accept="" onChange={(e) => onHandleSaveFile(e.target.files)} />
              <button className="br-btn br-btn-ghost br-btn-md br-btn-block" onClick={handleAccessTokenRequest}>
                {t("Subir Chat desde Google Drive")}
              </button>
              {isFirstFile && (
                <span className="br-link" style={{ cursor: "pointer", fontSize: 14 }} onClick={() => router.push("/help")}>
                  {t("¿Cómo hacerlo?")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
