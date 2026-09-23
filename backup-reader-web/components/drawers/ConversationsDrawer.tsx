import { FC, useContext, useEffect, useState, ReactElement } from "react";

import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { Text, Container, Collapse } from "@nextui-org/react";

import { FileList } from "../../models/Files";
import { AlertModal } from "../modals/AlertModal";
import { ModalContext } from "../../context/ModalContext";
import { StorageContext } from "../../context/StorageContext";
import { InformationModal } from "../modals/InformationModal";
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brass-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          );
        })}
      </div>


      
    </>
  );
};
