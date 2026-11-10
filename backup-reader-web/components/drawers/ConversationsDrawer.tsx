import { FC, useContext, useEffect, useRef, useState, ReactElement } from "react";

import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { Text, Container, Collapse } from "@nextui-org/react";

import { FileList } from "../../models/Files";
import { AlertModal } from "../modals/AlertModal";
import { ModalContext } from "../../context/ModalContext";
import { StorageContext } from "../../context/StorageContext";
import { InformationModal } from "../modals/InformationModal";
import { BotonCifrar } from "../vault/BotonCifrar";
import { BotonBorrarChat } from "../chat/BotonBorrarChat";
import { ResultadosGlobales } from "../chat/ResultadosGlobales";
import { useAtajoDeBusqueda } from "../../hooks/useAtajoDeBusqueda";

/** `t()` puede devolver null según sus tipos; esto lo deja en string. */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";
import { FirebaseAuth } from "../../config/firebase";
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
  const { show } = useContext(ModalContext);
  const { fileList, fetchBucketSize } = useContext(StorageContext);
  const [state, setState] = useState<FileList[] | null>();
  const [bucketSize, setBucketSize] = useState<number>(0);
  const [userEmail,setUserEmail] = useState<string | null>();
  const [instagramConversations, setInstagramConversations] = useState<JSX.Element[] | null>(null);
  /* Lo que se busca en TODOS los chats. Es estado de la barra lateral y no del
     dashboard porque el buscador tiene que funcionar sin ningún chat abierto. */
  const [consulta, setConsulta] = useState("");
  /* Comando-K lleva aqui el cursor desde cualquier parte de la aplicacion. */
  const campoBusqueda = useRef<HTMLInputElement>(null);
  useAtajoDeBusqueda(campoBusqueda);

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
  
  return (
    <>
      <Container
        style={{
          ...styles.container,
          flexDirection: "column",
        }}
      >
        <Typography
          fontSize={26}
          fontFamily={"var(--font-serif)"}
          style={styles.drawerTitle}
        >
          {t("Chats")}
        </Typography>
        { /* bucketSize === 0 ? <p style={{ fontSize: '11px', color: '#999999', marginLeft: '10px' }}> </p>  : <p style={{ fontSize: '11px', color: '#999999', marginLeft: '10px' }}>Conversaciones: { bucketSize } MB</p>  */ }
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', letterSpacing: '0.06em', color: 'var(--slate-500)', marginLeft: '10px' }}>{ userEmail }</p>

        {/* Buscar en TODOS los chats.
            Vive aquí, con la lista, y no en la barra del chat abierto: buscar
            en todos los chats es lo primero que se hace al entrar, y pedir que
            se abra uno antes es justo lo contrario de para qué sirve. */}
        <input
          ref={campoBusqueda}
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            /* Escape limpia lo escrito antes de soltar el campo: dejarlo con
               texto y sin foco deja los resultados abiertos tapando la lista
               de chats, que es lo contrario de lo que pide Escape. */
            if (e.key === "Escape" && consulta) {
              e.preventDefault();
              setConsulta("");
            }
          }}
          placeholder={enTexto(t("Buscar en todos los chats"))}
          style={{
            width: "calc(100% - 20px)",
            margin: "10px",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--ink-900)",
          }}
        />
        <div style={{ width: "calc(100% - 20px)", margin: "0 10px" }}>
          <ResultadosGlobales consulta={consulta} alAbrirChat={onPress} />
        </div>

      </Container>
      

      <div style={{ ...styles.drawerItemCtn }}>
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
          const isSelected = selected === item.name;
          const parts = splitNameDate(item.name);
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
                  padding: "14px 14px",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: "3px solid transparent",
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--slate-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--slate-500)" }}>
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
              onClick={() => onPress(item.fullPath, item.name)}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 14px",
                borderRadius: isSelected ? 10 : 0,
                borderBottom: isSelected ? "none" : "1px solid var(--border)",
                borderLeft: isSelected ? "3px solid var(--brass-500)" : "3px solid transparent",
                background: isSelected ? "var(--surface-raised)" : "transparent",
                boxShadow: isSelected ? "var(--shadow-card)" : "none",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {parts.name}
                </span>
                {parts.date && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "var(--slate-500)" }}>
                    {parts.date}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                {/* Un backup todavía en texto plano ofrece cifrarse en vez de
                    la flecha. Cuando no queden v1, esto vuelve a ser solo el svg. */}
                {item.cifrado ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                ) : (
                  <BotonCifrar fullPath={item.fullPath} name={item.name} />
                )}
                <BotonBorrarChat fullPath={item.fullPath} name={item.name} />
              </div>
            </div>
          );
        })}
      </div>


      
    </>
  );
};
