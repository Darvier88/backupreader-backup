import { FC, useEffect, useContext, useState } from "react";

import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { Container, Loading } from "@nextui-org/react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

import { FirebaseAuth } from "../../config/firebase";
import { AuthContext } from "../../context/AuthContext";
import { StorageContext } from "../../context/StorageContext";
import { FirebaseDB } from "../../config/firebase";
import { FirestoreContext } from "../../context/FirestoreContext";
import { useLoading } from "../../context/LoadingContext";
import { isWithinTrial } from "../../config/trial";

import {
  doc,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";

import { User } from "firebase/auth";

type LoadingComponentProps = {
  children: JSX.Element;
};

const styles = {
  container: {
    display: "flex",
    marginTop: "10%",
    justifyContent: "center",
  },
  text: {},
};

export const LoadingComponent: FC<LoadingComponentProps> = ({ children }) => {
  const { status } = useContext(AuthContext);
  const { user, getUser, getPlans } = useContext(FirestoreContext);
  const {
    getFiles,
    getFile,
    chat,
    progress,
    fileList,
    uploadStatus,
    recentFileName,
    downloadFileStatus,
    downloadFilesStatus,
  } = useContext(StorageContext);
  const router = useRouter();
  const { t } = useTranslation();
  const [converting, setConverting] = useState<boolean>(false);

  const { loading, setLoading } = useLoading();

  const [daysLeft, setDaysLeft] = useState<number>(0);

  const [cloudFunctionStatus,setCloudFunctionStatus] = useState<string>('non-processed');


  function extractChatName(path: string): string {
    const regex = /\/whatsapp\/([^\/]+)$/;
    const match = path.match(regex);
    return match ? match[1] : '';
  }


  useEffect(() => {
    if (uploadStatus === "saving") {
        setLoading(true);
        console.log('53');
    }
    if (uploadStatus === "saved") {
        setConverting(true);

    }
    return;
}, [uploadStatus]);


useEffect(()=>{

  if (!user) return;
  const userRef = doc(FirebaseDB, 'userStatus', user.uid);

        const unsubscribe = onSnapshot(userRef, async (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if(data.status !== ""){
                  const chatFullPath = data.status;
                  if(chatFullPath!==undefined){
                    const chatRemoteName = extractChatName(chatFullPath);

                    /*
                      Update all file list in the sidebar
                    */
                      getFiles(user.uid);

                    /*
                      If the user just uploaded an instagram conversation
                      this doesn't get processed inmediatelly since there
                      is no particular conversartion to load, the user
                      has to select one because it loads a batch of conv.
                    */
                    if (!chatFullPath.includes("instagram")){
                      getFile(chatFullPath, chatRemoteName);
                    }

                    /* 
                      Delete the record after we listen to it 
                    */
                    await deleteDoc(userRef).then(() => {
                      console.log('Document successfully deleted');
                    }).catch((error) => {
                      console.error('Error removing document: ', error);
                    });

                    

                    if (chatFullPath.includes("instagram")){
                      setConverting(false);
                      setLoading(false);
                    }

                  }
                }
            }
        }, (err) => {
            console.log(`Encountered error: ${err.message}`);
        });

        return unsubscribe;
},[user])



  useEffect(() => {
    if (downloadFileStatus === null) return;
      setLoading(true);
      console.log('69')
    if (downloadFileStatus === "downloading") {
      setLoading(true);
      console.log('72')
    }
    if(downloadFileStatus === "downloaded"){
      setLoading(false);
      console.log('76')
    }
    if (downloadFileStatus === "not-downloaded") {
      setLoading(false);
      console.log('79')
    }
    return;
  }, [downloadFileStatus]);



  useEffect(() => {
    if (!chat) return;
    if (chat?.length !== 0) {
      setLoading(false);
    }
  }, [chat]);

  useEffect(() => {
    if (!downloadFilesStatus === null) return;
    if (downloadFilesStatus === "downloading") {
      setLoading(true);
      console.log('122')
    }
    if (downloadFilesStatus === "not-downloaded") {
      setTimeout(() => {
        setLoading(false);
        console.log('127')
      }, 2000);
    }
    return;
  }, [downloadFilesStatus]);


  useEffect(() => {
    const handleRedirect = async (userF: User | null) => {

      const createdAt = userF?.metadata.creationTime;
      let creationDate;
      
      if( userF ){
        setLoading(true);
        setTimeout(()=>{
          getUser(userF.uid)
        },2000)

        getPlans();
        getFiles(userF.uid);

      
        if(createdAt){
          creationDate = new Date(createdAt);
          const currentDate = new Date();
          const timeDifference = currentDate.getTime() - creationDate.getTime();
          const differenceInDays = Math.floor(timeDifference / (1000 * 3600 * 24));
          setDaysLeft(differenceInDays);
        }
        
      }

    };
  
    onAuthStateChanged(FirebaseAuth, handleRedirect);
  
    return;
  }, []);
  

  useEffect(() => {


    if (user) {

      const hasAccess = user.plan || isWithinTrial(daysLeft);

      // Rutas por las que se llega justo tras crear cuenta o iniciar sesión.
      const cameFromAuth =
        router.pathname === "/login" || router.pathname === "/auth";

      if (hasAccess) {
        // Con plan (o prueba activa): al autenticarse o abrir la home, al dashboard.
        if (cameFromAuth || router.pathname === "/") {
          router.replace("/dashboard");
        }
        // En el resto de páginas (ayuda, cuenta, etc.) se le deja donde está.
      } else {
        // Sin plan ni prueba: mostrar /plans SOLO al crear cuenta / iniciar sesión,
        // o si intenta entrar al área protegida (/dashboard).
        // En las demás páginas NO se le fuerza a /plans.
        if (cameFromAuth || router.pathname === "/dashboard") {
          router.replace("/plans");
        }
      }

    }else{

      /* Si no hay usuario y entra al dashboard, lo mandamos al inicio.
         En cualquier otra ruta (marketing, legales) lo dejamos donde está;
         un router.replace a la misma ruta provoca "Cancel rendering route". */
      if(router.pathname=="/dashboard"){
        router.replace('/');
      }
    }

    setLoading(false);

  }, [user]);
  


  
  return (
    <>
      {loading ? (
        <Container
          style={{
            ...styles.container,
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {uploadStatus === "saving" ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Typography
                  fontSize={25}
                  fontFamily={"Open Sans"}
                  style={{ color: "#3C3C3C" }}
                >
                  {t("Subiendo chat")}
                </Typography>
                <CircularProgress
                  size={100}
                  value={progress}
                  variant="determinate"
                  sx={{ color: "#0F52BA", marginTop: 2 }}
                />
              </Box>
            </>
          ) : converting ? (
            <>
              <Typography
                fontSize={25}
                fontFamily={"Open Sans"}
                style={{ color: "#3C3C3C", marginBottom: 5 }}
              >
                {t("Extrayendo chat")}
              </Typography>
              <Loading
                loadingCss={{ $$loadingSize: "100px", $$loadingBorder: "10px" }}
              />
            </>
          ) : (
            <Loading
              loadingCss={{ $$loadingSize: "100px", $$loadingBorder: "10px" }}
            />
          )}
        </Container>
      ) : (
        children
      )}
    </>
  );
};