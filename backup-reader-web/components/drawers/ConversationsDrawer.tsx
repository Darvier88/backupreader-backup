import { FC, useContext, useEffect, useRef, useState, ReactElement } from "react";

import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { Text, Collapse } from "@nextui-org/react";

import { FileList } from "../../models/Files";
import { AlertModal } from "../modals/AlertModal";
import { ModalContext } from "../../context/ModalContext";
import { StorageContext } from "../../context/StorageContext";
import { InformationModal } from "../modals/InformationModal";
import { BotonCifrar } from "../vault/BotonCifrar";
import { BotonBorrarChat } from "../chat/BotonBorrarChat";
import { usePanelChats } from "../../context/PanelChatsContext";
import { backupIdDeHandle } from "../../lib/backupreader-crypto";
import { iniciales, nombreDelContacto } from "../../lib/nombres-de-chat";

/** `t()` puede devolver null según sus tipos; esto lo deja en string. */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";
import { FirebaseAuth } from "../../config/firebase";
import { useRouter } from "next/router";
import { AuthContext } from "../../context";
import { Logo, LangToggle } from "../ui/BrandChrome";
import { storage } from "../../config/firebase";

import {
  ref,
  list,
  ListResult
} from "firebase/storage";


const styles = {
  container: {
    marginTop: 20,
    width: "100%",
    display: "flex",
  },
  drawerContainer: {
    height: "100%",
    display: "flex",
    backgroundColor: "#FAFAFA",
    
  },
  drawerItemCtn: {
    padding: 5,
    width: "100%",
    marginTop: 20,
    marginBottom: 10,
  },
  drawerTitle: {
    marginTop: 3,
    marginLeft: 7,
    color: "var(--ink-900)",
    letterSpacing: "-0.015em",
    fontWeight: 500,
    "@xs": {
      fontSize: 22,
    },
    "@md": {
      fontSize: 26,
    },
  },
  drawerSubTitle: {
    color: "var(--ink-900)",
    letterSpacing: 0,
    fontWeight: 600,
    "@xs": {
      fontSize: 12,
    },
    "@md": {
      fontSize: 14,
    },
  },
  drawerFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
};

type ConversationsDrawerProps = {
  selected: string;
  onPress: (fullPath: string, name: string) => void;
};

// Separa "Nombre  Tue, Sep 15, 2026, 06 PM" en { name, date }.
function splitNameDate(full: string): { name: string; date: string } {
  const m = full.match(/^(.*?)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+.*(?:AM|PM))\s*$/i);
  if (m) {
    const date = m[2].trim().replace(/,\s*(\d{1,2}\s*[AP]M)\s*$/i, " · $1");
    return { name: m[1].trim(), date };
  }
  return { name: full, date: "" };
}
export const ConversationsDrawer: FC<ConversationsDrawerProps> = ({
  onPress,
  selected,
}) => {
  const { t } = useTranslation();
  /* Cuántas coincidencias tiene cada chat en la búsqueda en curso (8c).
     Lo escribe la lista de resultados del centro. */
  const { porChat, chatFiltro, setChatFiltro } = usePanelChats();
  /* Hay una búsqueda con resultados en curso: el panel filtra en vez de abrir. */
  const buscando = Object.keys(porChat).length > 0;
  const { show } = useContext(ModalContext);
  const { fileList, fetchBucketSize } = useContext(StorageContext);
  const [state, setState] = useState<FileList[] | null>();
  const [bucketSize, setBucketSize] = useState<number>(0);
  const [userEmail,setUserEmail] = useState<string | null>();
  const [userName, setUserName] = useState<string>("");
  /* «Agregar chat» abre aquí mismo las dos opciones, en vez de llevarlas
     siempre a la vista al fondo del panel (8b). */
  const [agregando, setAgregando] = useState(false);
  const router = useRouter();
  const { logOut } = useContext(AuthContext);
  const [instagramConversations, setInstagramConversations] = useState<JSX.Element[] | null>(null);
  /* Lo que se busca en TODOS los chats. Es estado de la barra lateral y no del
     dashboard porque el buscador tiene que funcionar sin ningún chat abierto. */
  /* Comando-K lleva aqui el cursor desde cualquier parte de la aplicacion. */

  const deletingFile = () => {
    show({
      modalContent: (
        <InformationModal
          title={t("Solicitud enviada")}
          text={t("Esta conversacíon sera eliminada en breve")}
        />
      ),
    });
  };

  const onHandleDeleteFile = (fullPath: string) => {
    show({
      modalContent: (
        <AlertModal
          title={t("Advertencia")}
          text={t("¿Deseas eliminar esta conversación?")}
          onPress={deletingFile}
        />
      ),
    });
  };

  function extractUsername(instagramString: string): string {
    if (!instagramString.includes('_')) {
        return instagramString;
    }
    
    const parts = instagramString.split('_');
    const username = parts[0];

    if (username.includes(' ')) {
        return instagramString;
    }
    return username;
  }



  const getInstagramConversations = async (route: string) => {
      try {
        // Fetch results from the original path based on route
        const originalListRef = ref(storage, `${route}/messages/inbox/`);
        // Use the type from ListResult for prefixes
        let originalPrefixes: ListResult['prefixes'] = [];
        let hasOriginalFiles = false;
        try {
          const originalResults: ListResult = await list(originalListRef);
          originalPrefixes = originalResults.prefixes;
          hasOriginalFiles = originalPrefixes.length > 0;
        } catch (error) {
          console.error("Error fetching from original path:", error);
        }

        // Fetch results from the alternative path only if original path is empty
        let alternativePrefixes: ListResult['prefixes'] = [];
        if (!hasOriginalFiles) {
          const alternativeListRef = ref(storage, `${route}/your_instagram_activity/messages/inbox/`);
          try {
            const alternativeResults: ListResult = await list(alternativeListRef);
            alternativePrefixes = alternativeResults.prefixes;
          } catch (error) {
            console.error("Error fetching from alternative path:", error);
          }
        }

        // Determine which prefixes to use based on availability
        const combinedResults = hasOriginalFiles ? originalPrefixes : alternativePrefixes;

        // Create elements from the chosen results
        const elements = combinedResults.map((item, index) => (
          <div key={index} onClick={() => onPress(item.fullPath, item.name)}>
            <Text>{extractUsername(item.name)}</Text>
          </div>
        ));

        return elements;  // Return the array of JSX elements
      } catch (error) {
        console.error("Error in getInstagramConversations:", error);
        return [];  // Return empty array on error
      }
  };


  const loadConversations = async (path: string) => {
    try {
      // Replace 'getInstagramConversations' with your actual data fetching logic
      const newConversations = await getInstagramConversations(path);
      setInstagramConversations(newConversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };
  

  useEffect(() => {
    if (fileList?.length === 0) {
      return;
    } else {
      setState(fileList);
    }
  }, [fileList]);

  useEffect(()=>{
    if(FirebaseAuth.currentUser){
      const email = FirebaseAuth.currentUser.email;
      setUserEmail(email);
      setUserName(FirebaseAuth.currentUser.displayName?.trim() || "");
    }
  },[]);

  /*

  fetchBucketSize()
  .then(bucketSizeMb => {
    setBucketSize(bucketSizeMb)
  })
  .catch(error => {
    console.error('Error fetching bucket size:', error);
  });
  */
  
  /* Panel a toda la altura (8b): logo y «Agregar chat» arriba, la lista en
     medio con su propio scroll y la cuenta fija abajo. */
  return (
    <div style={{ position: "sticky", top: 0, height: "100vh", width: "100%", display: "flex", flexDirection: "column", padding: "20px 12px 16px", gap: 20, background: "var(--paper-100)" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {/* Panel lateral fijo (8b): en escritorio no hay cabecera arriba,
            así que el logo, «Agregar chat» y la cuenta viven aquí. */}
        <div style={{ padding: "0 8px", marginBottom: 20 }}>
          <Logo compact />
        </div>

        <button
          type="button"
          className="br-btn br-btn-ghost br-btn-md"
          aria-expanded={agregando}
          onClick={() => setAgregando((v) => !v)}
          style={{ margin: "0 8px", width: "calc(100% - 16px)", border: "1.5px solid var(--ink-900)", color: "var(--ink-900)" }}
        >
          {t("Agregar chat")}
        </button>
        {agregando && (
          <div style={{ display: "flex", gap: 8, margin: "10px 8px 0" }}>
            <button
              type="button"
              className="br-btn br-btn-ghost br-btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setAgregando(false);
                window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "drive" }));
              }}
            >
              {t("Google Drive")}
            </button>
            <button
              type="button"
              className="br-btn br-btn-ghost br-btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setAgregando(false);
                window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "archivos" }));
              }}
            >
              {t("Archivos")}
            </button>
          </div>
        )}

        {/* El buscador general ya no vive aquí (8b).
            Estaba en esta columna, y con él los resultados: una lista de
            mensajes de 300px de ancho, al lado de una pantalla vacía. Ahora
            está en el centro del inicio, que es donde hay sitio para leer lo
            que encuentra. Lo que sí se queda aquí es cuántas coincidencias
            tiene cada chat, junto a su nombre (8c).
            ⌘K sigue funcionando: cierra el chat abierto y lleva allí. */}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)", margin: 0, padding: "0 8px 6px" }}>
          {enTexto(t("Tus chats · {{n}}", { n: state?.length ?? 0 }))}
        </p>
        {state?.map((item, i) => {

          // Check if the item is an Instagram conversation based on the name
          const isInstagram = item.name.includes("instagram-");

          // Render the Instagram conversations within a collapse component
          if (isInstagram) {
            return (
              <Collapse.Group 
                key={i} 
                style={{ fontSize: 12 }}
                onClick={() => { 
                  loadConversations(item.fullPath);  // This function is called, not rendered
                }}
              >
                <Collapse style={{ color: '#999999' }} title={item.name}>
                  {instagramConversations && instagramConversations.map((conversation, index) => (
                    <div style={{ fontSize: 8, marginBottom: 10, cursor: 'pointer' }} key={index}>{conversation}</div>
                  ))}
                </Collapse>
              </Collapse.Group>
            );
          }

          // For non-Instagram items (e.g., WhatsApp), keep the original rendering logic
          /* También se marca el chat al que se están limitando los resultados. */
          const isSelected =
            selected === item.name ||
            (buscando && !!chatFiltro && chatFiltro === (backupIdDeHandle(item.fullPath) ?? ""));
          const parts = splitNameDate(item.name);
          const coincidencias = porChat[backupIdDeHandle(item.fullPath) ?? ""];
          /* Boveda bloqueada: el chat existe pero su nombre vive dentro del
             manifiesto cifrado, asi que todavia no se puede leer. Se pinta con
             candado y no se deja abrir, en vez de esconderlo: esconderlo haria
             creer que no hay chats. (Pantalla 4d.) */
          if (item.bloqueado) {
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 8,
                  borderRadius: 8,
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span aria-hidden style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--slate-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--slate-500)" }}>
                    {t("Chat cifrado")}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--slate-500)", flexShrink: 0 }}>
                  {t("Bloqueado")}
                </span>
              </div>
            );
          }
          return (
            <div
              key={i}
              data-fila-chat
              onClick={() => {
                /* Durante una búsqueda, pulsar un chat con coincidencias
                   limita los resultados a ese chat (8c); pulsarlo otra vez
                   vuelve a todos. Sin búsqueda, abre el chat como siempre. */
                const id = backupIdDeHandle(item.fullPath) ?? "";
                if (buscando && coincidencias) {
                  setChatFiltro(chatFiltro === id ? null : id);
                  return;
                }
                onPress(item.fullPath, item.name);
              }}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: 8,
                borderRadius: 8,
                background: isSelected ? "var(--brass-100)" : "transparent",
              }}
            >
              {/* Iniciales y nombre del contacto, no el nombre del archivo
                  (8b). "Chat de WhatsApp con Yuli.zip" empieza igual en todos
                  los chats, así que hay que leer hasta el final de cada fila
                  para distinguirlas; el panel móvil ya lo hacía así. */}
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  /* El primero (o el abierto) en tinta, el resto en blanco (8b). */
                  background: isSelected || (!selected && i === 0) ? "var(--ink-900)" : "#fff",
                  border: isSelected || (!selected && i === 0) ? "none" : "1px solid var(--border)",
                  color: isSelected || (!selected && i === 0) ? "var(--paper-50)" : "var(--ink-900)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 13,
                }}
              >
                {iniciales(item.name)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nombreDelContacto(item.name) || parts.name}
                </span>
                {/* Con una búsqueda en curso, el número manda sobre la fecha:
                    lo que se quiere saber en ese momento es dónde está lo
                    buscado, no cuándo se guardó el chat. */}
                {coincidencias !== undefined ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", color: "var(--slate-500)" }}>
                    {coincidencias === 1
                      ? enTexto(t("1 coincidencia"))
                      : enTexto(t("{{total}} coincidencias", { total: coincidencias }))}
                  </span>
                ) : (
                  /* El archivo en mono debajo del nombre (8b). */
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--slate-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                {/* Un backup todavía en texto plano ofrece cifrarse en vez de
                    la flecha. Cuando no queden v1, esto vuelve a ser solo el svg. */}
                {!item.cifrado && (
                  <BotonCifrar fullPath={item.fullPath} name={item.name} />
                )}
                <BotonBorrarChat fullPath={item.fullPath} name={item.name} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Cuenta, abajo del panel (8b). Sustituye a la cabecera que había
          encima del dashboard en escritorio: Mi cuenta, Ayuda, Cerrar sesión
          y el idioma, en el sitio donde el diseño los pone. */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "10px 8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "var(--brass-100)", color: "var(--brass-700)",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
            }}
          >
            {(userName || userEmail || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName || userEmail}
            </span>
            {userName && userEmail && (
              <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--slate-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userEmail}
              </span>
            )}
          </span>
          <LangToggle />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 6, marginLeft: -8 }}>
          <button type="button" className="br-enlace-panel" onClick={() => router.push("/account")}>
            {t("Mi cuenta")}
          </button>
          <button type="button" className="br-enlace-panel" onClick={() => router.push("/help")}>
            {t("Ayuda")}
          </button>
          <button type="button" className="br-enlace-panel" onClick={() => logOut()}>
            {t("Cerrar sesión")}
          </button>
        </div>
      </div>
    </div>
  );
};
