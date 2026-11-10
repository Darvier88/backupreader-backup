import { FC, useContext, useState } from "react";

import { Text, Button, Collapse } from "@nextui-org/react";
import { StorageContext } from "../../context/StorageContext";
import { BotonCifrar } from "../vault/BotonCifrar";
import { BotonBorrarChat } from "../chat/BotonBorrarChat";
import { ResultadosGlobales } from "../chat/ResultadosGlobales";
import { Box, Container, Drawer, Typography } from "@mui/material";
import { storage } from "../../config/firebase";
import {
  ref,
  list,
  ListResult
} from "firebase/storage";


const styles = {
  drawerTitle: {
    marginTop: 3,
    letterSpacing: 0.5,
    fontSize: 20,
  },
  drawerSubTitle: {
    color: "#3C3C3C",
    letterSpacing: 0.5,
    fontWeight: "bold",
    fontSize: 10,
  },
};


type ConversationsDrawerMobileProps = {
  openState: boolean;
  setOpenState: (value: boolean) => void;
};

export const ConversationsDrawerMobile: FC<ConversationsDrawerMobileProps> = ({
  openState,
  setOpenState,
  
}) => {
  const { fileList } = useContext(StorageContext);
  const { getFile } = useContext(StorageContext);
  const onHandleGetFile = (fullPath: string, name: string) => {
    getFile(fullPath, name);
    setOpenState(false);
  };

  const [instagramConversations, setInstagramConversations] = useState<JSX.Element[] | null>(null);
  /* Lo buscado en TODOS los chats. */
  const [consulta, setConsulta] = useState("");

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
          <div key={index} onClick={() => onHandleGetFile(item.fullPath, item.name)}>
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
      const newConversations = await getInstagramConversations(path);
      setInstagramConversations(newConversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  return (
    <Drawer
      anchor={"left"}
      open={openState}
      onClose={() => setOpenState(false)}
      /* El velo va en tinta y no en el gris del navegador: el gris de serie
         enfria toda la pantalla y rompe el papel calido del resto. */
      slotProps={{ backdrop: { style: { backgroundColor: "rgba(15,24,38,0.55)" } } }}
      PaperProps={{ style: { width: 322, background: "var(--paper-50)" } }}
    >
      <Container style={{ width: 322, padding: 0 }}>
        <Box
          marginTop={3}
          marginBottom={2}
          paddingX={"10px"}
          display={"flex"}
          alignItems={"center"}
          justifyContent={"space-between"}
        >
          <Typography
            fontFamily={"var(--font-serif)"}
            style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-900)" }}
          >
            BackupReader
          </Typography>
          {/* Cerrar el panel desde dentro: en un telefono grande el borde
              derecho de la pantalla no siempre llega con el pulgar. */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpenState(false)}
            style={{
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--slate-500)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </Box>

        {/* Buscar en todos los chats, igual que en escritorio: tiene que estar
            disponible sin abrir ninguno. Al pulsar un resultado se abre ese
            chat y el cajón se cierra, que es lo que ya hace onHandleGetFile. */}
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar en todos los chats"
          style={{
            width: "calc(100% - 20px)",
            margin: "0 10px 10px",
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
          <ResultadosGlobales consulta={consulta} alAbrirChat={onHandleGetFile} />
        </div>

        {fileList?.map((item, i) =>{

          const isInstagram = item.name.includes("instagram-");

          // Render the Instagram conversations within a collapse component
          if (isInstagram) {
            return (
              <Collapse.Group 
                key={i} 
                style={{ fontSize: 12 }}
                onClick={() => { 
                  loadConversations(item.fullPath);
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


          /* El botón de cifrar va FUERA del <Button>, no dentro: un botón
             anidado en otro es HTML inválido y el clic se vuelve impredecible.
             Por eso la fila pasa a ser un div con los dos al lado. */
          return  (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 15,
              }}
            >
              <Button
                auto
                light
                color="primary"
                onPress={() => onHandleGetFile(item.fullPath, item.name)}
              >
                <Typography fontFamily={"Open Sans"} style={styles.drawerSubTitle}>
                  {item.name}
                </Typography>
              </Button>
              {!item.cifrado && (
                <BotonCifrar fullPath={item.fullPath} name={item.name} />
              )}
              <BotonBorrarChat fullPath={item.fullPath} name={item.name} />
            </div>
          )
        })}

      </Container>
    </Drawer>
  );
};
