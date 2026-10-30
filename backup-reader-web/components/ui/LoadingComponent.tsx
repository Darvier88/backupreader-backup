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
import { tieneAcceso } from "../../config/acceso";

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


  /* La subida YA NO pasa por `loading`.
   *
   * Antes sí: `uploadStatus === "saving"` encendía el spinner global y la
   * pantalla "Subiendo chat" se dibujaba dentro de él. El problema es que ese
   * mismo `loading` lo apagan otros cuatro sitios que no saben nada de la
   * subida —la llegada del documento de Firestore, el fin de `getFiles`, la
   * selección de un chat y la red de seguridad de 15 s—, así que a mitad de
   * una subida larga el aviso desaparecía y volvía el dashboard. Y como
   * `uploadStatus` seguía en "saving", cualquier otra cosa que volviera a
   * encender `loading` (abrir un chat, por ejemplo) hacía reaparecer
   * "Subiendo chat" de golpe: justo lo que daba la sensación de que la subida
   * ni había empezado o iba a saltos.
   *
   * Ahora la subida tiene su propia capa (`SubidaEnCurso`), que se dibuja
   * ENCIMA del dashboard y depende solo de `uploadStatus`. Mientras dure, se
   * ve; cuando termina o falla, se va. Nadie más puede apagarla. */


  /* Si la pestaña se cierra o se recarga a mitad de una subida, no se pierde
     solo el aviso: se pierde la subida entera, porque el cifrado corre aquí,
     en el navegador, y no hay nada en el servidor que pueda continuarla. Hasta
     ahora eso ocurría en silencio. Esto hace que el navegador pregunte.

     No cubre que el navegador DESCARTE la pestaña por falta de memoria —eso no
     lo puede impedir ninguna página—, pero sí el cerrar, recargar o navegar
     fuera, que es lo que se hace sin querer. */
  useEffect(() => {
    if (uploadStatus !== "saving") return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
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
    /* Faltaba el caso bueno: "downloaded". Solo se apagaba el spinner cuando
       la lista fallaba ("not-downloaded"), así que al terminar bien —que es lo
       que pasa al refrescar la barra lateral después de subir— nadie lo
       apagaba y se quedaba girando hasta la red de seguridad de 15 s. */
    if (downloadFilesStatus === "downloaded") {
      setLoading(false);
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

      /* `tieneAcceso` en vez de `user.plan || isWithinTrial(...)`: ahora un
         plan puede estar cancelado y seguir valiendo hasta el final del
         periodo pagado. La regla entera vive en config/acceso.ts. */
      const hasAccess = tieneAcceso(user, daysLeft);

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


  const subiendo = uploadStatus === "saving";

  return (
    <>
      {/* Mientras se sube se deja el dashboard debajo: la capa de subida ya
          tapa la pantalla, y cambiar además lo de abajo era parte del efecto
          de "la página se cambia sola". */}
      {loading && !subiendo ? (
        <Container
          style={{
            ...styles.container,
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Loading
            loadingCss={{ $$loadingSize: "100px", $$loadingBorder: "10px" }}
          />
        </Container>
      ) : (
        children
      )}

      {subiendo && <SubidaEnCurso progreso={progress} />}
    </>
  );
};

/**
 * Capa de "Subiendo chat".
 *
 * Fija, centrada y por encima de todo (incluidos los modales de NextUI, que
 * viven sobre el z-index 1000). Bloquea el clic a propósito: mientras se cifra
 * y se sube no hay nada útil que tocar, y evita que se lance una segunda
 * subida encima de la primera.
 *
 * El progreso es determinado solo cuando hay un porcentaje real que enseñar.
 * Con `variant="determinate"` y `value={0}` —que es como estaba— se pinta un
 * círculo vacío y quieto durante los primeros segundos, que es exactamente la
 * imagen de "esto no está haciendo nada".
 */
const SubidaEnCurso: FC<{ progreso: number }> = ({ progreso }) => {
  const { t } = useTranslation();
  const pct = Math.max(0, Math.min(100, Math.round(progreso || 0)));
  const arrancando = pct <= 0;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(27, 31, 35, 0.45)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        className="br-card"
        style={{
          width: "min(420px, 100%)",
          padding: "34px 28px",
          textAlign: "center",
          background: "var(--paper-50, #FAF7F0)",
        }}
      >
        <Box sx={{ position: "relative", display: "inline-flex", marginBottom: 2 }}>
          <CircularProgress
            size={96}
            thickness={3.5}
            value={arrancando ? undefined : pct}
            variant={arrancando ? "indeterminate" : "determinate"}
            sx={{ color: "var(--brass-500, #0F52BA)" }}
          />
          {!arrancando && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                fontSize={18}
                style={{ color: "var(--ink-900, #3C3C3C)", fontVariantNumeric: "tabular-nums" }}
              >
                {pct}%
              </Typography>
            </Box>
          )}
        </Box>

        <Typography
          fontSize={22}
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--ink-900, #3C3C3C)",
            marginBottom: 6,
          }}
        >
          {t("Subiendo chat")}
        </Typography>

        <Typography fontSize={14.5} style={{ color: "var(--slate-700, #5A5A5A)", lineHeight: 1.55 }}>
          {t("Se está cifrando en tu navegador antes de subirse. No cierres esta pestaña.")}
        </Typography>
      </div>
    </div>
  );
};
