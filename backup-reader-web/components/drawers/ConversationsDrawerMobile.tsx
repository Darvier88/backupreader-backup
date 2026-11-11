import { CSSProperties, FC, useContext, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { Text, Button, Collapse } from "@nextui-org/react";
import { StorageContext } from "../../context/StorageContext";
import { AuthContext } from "../../context";
import { BotonCifrar } from "../vault/BotonCifrar";
import { BotonBorrarChat } from "../chat/BotonBorrarChat";
import { ResultadosGlobales } from "../chat/ResultadosGlobales";
import { nombreDelContacto, partirTitulo, iniciales } from "../../lib/nombres-de-chat";
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


/** `t()` puede devolver null segun sus tipos; aqui se espera siempre texto. */
const enTextoM = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/* Los enlaces del pie comparten forma: 44px de alto, alineados a la
   izquierda como la lista, y sin aspecto de boton, porque son navegacion y
   no acciones destacadas. */
const enlacePanel: CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  textAlign: "left",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--ink-900)",
};

type ConversationsDrawerMobileProps = {
  openState: boolean;
  setOpenState: (value: boolean) => void;
};

export const ConversationsDrawerMobile: FC<ConversationsDrawerMobileProps> = ({
  openState,
  setOpenState,
  
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { logOut } = useContext(AuthContext);
  const { fileList, chatName } = useContext(StorageContext);
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
            aria-label={enTextoM(t("Cerrar"))}
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
          placeholder={enTextoM(t("Buscar en todos los chats"))}
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

        {/* Cuantos chats hay (1b). Sin el contador, una lista larga no dice
            si estan todos: el usuario que subio diez y ve seis en pantalla no
            sabe si faltan cuatro o si hay que desplazarse. */}
        <p
          style={{
            margin: "6px 12px 4px",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--slate-500)",
          }}
        >
          {enTextoM(t("Tus chats · {{n}}", { n: fileList?.length ?? 0 }))}
        </p>

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
          /* Fila de chat (pantalla 1b).
             Antes era un <Button> de NextUI con el nombre crudo del archivo en
             10px: "Chat de WhatsApp con Mama Tue, Sep 15, 2026, 07 PM". Eso no
             se lee de un vistazo y, con varios chats, todos empiezan igual, asi
             que hay que leer hasta el final de cada uno para distinguirlos.
             Ahora: iniciales, nombre del contacto y la fecha debajo. */
          const nombre = nombreDelContacto(item.name);
          const { fecha } = partirTitulo(item.name);
          const activo = chatName === item.name;

          return  (
            <div
              key={i}
              data-fila-chat
              onClick={() => onHandleGetFile(item.fullPath, item.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                cursor: "pointer",
                borderLeft: activo ? "3px solid var(--brass-500)" : "3px solid transparent",
                background: activo ? "var(--paper-100)" : "transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--paper-200)",
                  color: "var(--slate-700)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                }}
              >
                {iniciales(nombre)}
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                    fontWeight: activo ? 600 : 500,
                    color: "var(--ink-900)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {nombre}
                </span>
                {fecha && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      letterSpacing: "0.06em",
                      color: "var(--slate-500)",
                    }}
                  >
                    {fecha}
                  </span>
                )}
              </span>

              {!item.cifrado && (
                <BotonCifrar fullPath={item.fullPath} name={item.name} />
              )}
              <BotonBorrarChat fullPath={item.fullPath} name={item.name} />
            </div>
          )
        })}


        {/* Lo que el panel tenia que ofrecer ademas de la lista (1b).
            Estaba todo en la cabecera de la aplicacion, que en movil se
            queda detras del panel: con el panel abierto no habia forma de
            agregar un chat ni de llegar a la cuenta sin cerrarlo antes. */}
        <div style={{ marginTop: 22, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p
            style={{
              margin: "0 12px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--slate-500)",
            }}
          >
            {t("Agregar chat")}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpenState(false);
              window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "archivos" }));
            }}
            style={enlacePanel}
          >
            {t("Desde Archivos")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenState(false);
              window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "drive" }));
            }}
            style={enlacePanel}
          >
            {t("Desde Google Drive")}
          </button>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14, paddingBottom: 20 }}>
          <button
            type="button"
            onClick={() => { setOpenState(false); router.push("/account"); }}
            style={enlacePanel}
          >
            {t("Mi cuenta")}
          </button>
          <button
            type="button"
            onClick={() => { setOpenState(false); logOut(); }}
            style={{ ...enlacePanel, color: "var(--slate-700)" }}
          >
            {t("Cerrar sesión")}
          </button>
        </div>
      </Container>
    </Drawer>
  );
};
