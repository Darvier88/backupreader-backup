import { FC, useContext, useState } from "react";

import { Text, Button, Collapse } from "@nextui-org/react";
import { StorageContext } from "../../context/StorageContext";
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
    >
      <Container style={{ width: 310 }}>
        <Box marginTop={5} marginBottom={5}>
          <Typography
            fontFamily={"PT Serif"}
            style={{
              ...styles.drawerTitle,
              textAlign: "center",
              color: "#3C3C3C",
            }}
          >
            Chats
          </Typography>
        </Box>

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


          return  (
            <Button
              key={i}
              style={{
                marginTop: 15,
              }}
              auto
              light
              color="primary"
              onPress={() => onHandleGetFile(item.fullPath, item.name)}
            >
              <Typography fontFamily={"Open Sans"} style={styles.drawerSubTitle}>
                {item.name}
              </Typography>
            </Button>
            
          )
        })}

      </Container>
    </Drawer>
  );
};
