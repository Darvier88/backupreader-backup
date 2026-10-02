import { FC, useEffect, useContext, useState } from "react";

import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { Container, Loading } from "@nextui-org/react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

import { FirebaseAuth } from "../../config/firebase";
import { AuthContext } from "../../context/AuthContext";
import { StorageContext } from "../../context/StorageContext";
import { FirestoreContext } from "../../context/FirestoreContext";
import { useLoading } from "../../context/LoadingContext";
import { isWithinTrial } from "../../config/trial";

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
    chat,
    progress,
    uploadStatus,
    downloadFileStatus,
    downloadFilesStatus,
  } = useContext(StorageContext);
  const router = useRouter();
  const { t } = useTranslation();

  const { loading, setLoading } = useLoading();

  const [daysLeft, setDaysLeft] = useState<number>(0);

  /**
   * Estado de la comprobación de sesión.
   *
   * `authChecked` pasa a true cuando Firebase ya dijo si hay sesión o no, y
   * `firebaseUser` guarda esa respuesta. Hacen falta los dos porque `user` (el
   * documento de Firestore) llega DESPUÉS: entre el primer render y esa
   * llegada hay una ventana en la que `user` es null aunque sí haya sesión, y
   * decidir redirecciones dentro de esa ventana era lo que expulsaba del
   * dashboard al recargar.
   */
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);


  useEffect(() => {
    if (uploadStatus === "saving") setLoading(true);
    return;
  }, [uploadStatus]);


  /* El listener de `userStatus` se retiró en la Etapa 6.
     Lo escribía la Cloud Function `unzip` para avisar de que había terminado de
     descomprimir en el servidor. Con E2EE no hay nada que descomprimir ahí: el
     cliente cifra, sube, y sabe por sí mismo cuándo terminó. Con él se va el
     estado "Extrayendo chat", que ya no corresponde a ninguna fase real, y el
     refresco de la barra lateral pasó a hacerlo `saveFile` al terminar. */


  useEffect(() => {
    if (downloadFileStatus === null) return;
      setLoading(true);
    if (downloadFileStatus === "downloading") {
      setLoading(true);
    }
    if(downloadFileStatus === "downloaded"){
      setLoading(false);
    }
    if (downloadFileStatus === "not-downloaded") {
      setLoading(false);
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
    if (downloadFilesStatus === "downloading") {
      setLoading(true);
    }
    if (downloadFilesStatus === "not-downloaded") {
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
    return;
  }, [downloadFilesStatus]);


  useEffect(() => {
    const unsub = onAuthStateChanged(FirebaseAuth, (userF: User | null) => {
      setFirebaseUser(userF);
      setAuthChecked(true);

      if (!userF) {
        setLoading(false);
        return;
      }

      setLoading(true);

      /* Antes esto iba dentro de un setTimeout de 2 s. No había motivo para
         esperar, y ese retraso era justo lo que perdía la carrera contra la
         redirección de abajo: para cuando llegaba el usuario, ya se le había
         echado del dashboard.

         El segundo argumento es el plan B: si la credencial existe pero falta
         el documento de Firestore, `getUser` lo crea con estos datos en vez de
         dejar la cuenta en un limbo del que no se sale. */
      getUser(userF.uid, {
        uid: userF.uid,
        email: userF.email,
        displayName: userF.displayName,
        photoURL: userF.photoURL,
      });
      getPlans();
      getFiles(userF.uid);

      const createdAt = userF.metadata.creationTime;
      if (createdAt) {
        const diff = Date.now() - new Date(createdAt).getTime();
        setDaysLeft(Math.floor(diff / (1000 * 3600 * 24)));
      }
    });

    /* Antes no se devolvía la función de baja: el listener sobrevivía al
       desmontaje y se acumulaba uno por cada montaje del componente. */
    return unsub;
  }, []);


  useEffect(() => {

    /* Mientras Firebase no haya confirmado si hay sesión, no se decide nada:
       ni redirecciones ni apagar el spinner. */
    if (!authChecked) return;

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

      setLoading(false);
      return;
    }

    if (!firebaseUser) {

      /* Ahora sí consta que no hay sesión, así que se puede expulsar del área
         privada. En cualquier otra ruta (marketing, legales) se le deja donde
         está; un router.replace a la misma ruta provoca "Cancel rendering
         route". */
      if (router.pathname === "/dashboard") {
        router.replace("/");
      }
      setLoading(false);
      return;
    }

    /* Hay sesión pero el documento de Firestore todavía no ha llegado.
       No se expulsa ni se apaga el spinner: se espera a getUser. */

  }, [user, authChecked, firebaseUser, daysLeft]);


  /* Red de seguridad: si algo falla y nadie apaga el spinner, se apaga solo a
     los 15 s. Es preferible una pantalla vacía a dejar al usuario mirando una
     rueda para siempre, sin poder ni cerrar sesión. */
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(t);
  }, [loading]);


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
