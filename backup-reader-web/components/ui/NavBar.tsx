import { FC, useContext, useEffect, useRef } from "react";

import { Spacer, Grid } from "@nextui-org/react";
import { AuthContext, FirestoreContext } from "../../context";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { FirebaseAuth } from "../../config/firebase";
import { ConversationDrawerBtn } from "../buttons";
import LogoutIcon from "@mui/icons-material/Logout";
import { Logo, LangToggle } from "./BrandChrome";

import {
  Box,
  IconButton,
  Theme,
  useMediaQuery,
} from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { StorageContext } from "../../context/StorageContext";
import { SystemMessage } from "../alerts";
import { isWithinTrial } from "../../config/trial";

/**
 * Cabecera de las rutas de app que no usan `BrandHeader`: el dashboard en
 * móvil, /account, /initialDashboard y cualquier ruta nueva.
 *
 * Antes era una barra azul (#0F52BA) con el logo en PNG, mientras el dashboard
 * en escritorio ya usaba la cabecera de papel con el logo en SVG: dos marcas
 * distintas según el ancho de la pantalla. Ahora comparte con `BrandHeader` el
 * mismo `Logo`, el mismo `LangToggle` y las mismas clases `br-header`, así que
 * lo único que cambia entre pantallas es qué controles caben.
 *
 * Lo que va DEBAJO de la cabecera —el aviso de días de prueba y el botón del
 * cajón de chats— no se tocó: son hermanos de la barra, no hijos suyos.
 */

type NavBarProps = {
  drawerButtonOnPress: () => void;
};

const enlace: React.CSSProperties = { cursor: "pointer" };

/* Rutas donde no se ofrece "Comienza ahora" a quien no ha iniciado sesión.
   Misma lista que antes, solo que extraída para que se lea de un vistazo. */
const SIN_LLAMADA_A_LA_ACCION = [
  "/dashboard",
  "/help",
  "/termsConditions",
  "/privacyPolicy",
];

export const NavBar: FC<NavBarProps> = ({ drawerButtonOnPress }) => {
  const hiddenFileInput = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { t } = useTranslation();
  const { logOut } = useContext(AuthContext);
  const { saveFile } = useContext(StorageContext);
  const { user, getUser, getPlans, clean } = useContext(FirestoreContext);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);

  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  const onHandleLogout = () => {
    logOut();
    setTimeout(() => {
      clean();
    }, 1000);
  };

  const onHandleSaveFile = (file: any | null) => {

    const maxSize = 200 * 1024 * 1024;

    if (!file) return;
    if(file.size > maxSize){
      alert('Puedes subir hasta conversaciones de 200 Megabytes')
    }else{
      saveFile(file);
    }
  };


  useEffect(() => {
    const handleRedirect = async (userF: User | null) => {
      const createdAt = userF?.metadata.creationTime;

      if( userF ){
        setTimeout(()=>{
          getUser(userF.uid)
        },2000)

        getPlans();

        if(createdAt){
          const creationDate = new Date(createdAt);
          const currentDate = new Date();
          const timeDifference = currentDate.getTime() - creationDate.getTime();
          const differenceInDays = Math.floor(timeDifference / (1000 * 3600 * 24));
          setDaysLeft( 15 - differenceInDays )
        }
      }

    }

    onAuthStateChanged(FirebaseAuth, handleRedirect);

    return;
  }, []);


  useEffect(()=>{
    const isAndroid = (): boolean => {
      if (typeof navigator !== 'undefined') {
        return /Android/i.test(navigator.userAgent);
      }
      return false;
    };
    setIsAndroidDevice(isAndroid());
  },[]);


  return (
    <>
      <header className="br-header">
        {/* maxWidth 1360: el mismo que usa BrandHeader en el dashboard, para
            que el logo caiga a la misma altura en las dos pantallas. */}
        <div className="br-header-inner" style={{ maxWidth: 1360 }}>
          <Logo
            compact={phone}
            onClick={() => {
              if (
                router.pathname !== "/dashboard" &&
                router.pathname !== "/initialDashboard"
              ) {
                router.replace("/");
              }
            }}
          />

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: phone ? 6 : "clamp(14px,2.2vw,24px)",
              flexWrap: "nowrap",
            }}
          >
            {!user && !SIN_LLAMADA_A_LA_ACCION.includes(router.pathname) && (
              <button
                className="br-btn br-btn-primary br-btn-sm"
                onClick={() => router.push("/auth")}
              >
                {t("Comienza ahora")}
              </button>
            )}

            {user && !phone && router.pathname === "/help" && (
              <span
                className="br-navlink"
                style={enlace}
                onClick={() => router.push("/dashboard")}
              >
                {t("Chats")}
              </span>
            )}

            {user && !phone && (
              <span
                className="br-navlink"
                style={enlace}
                onClick={() => router.push("/help")}
              >
                {t("Ayuda")}
              </span>
            )}

            {/* En escritorio, enlace de texto como en BrandHeader. En móvil,
                icono: el texto más el selector de idioma no caben en 360 px y
                la cabecera se partía en dos filas. */}
            {user && !phone && (
              <span className="br-navlink" style={enlace} onClick={onHandleLogout}>
                {t("Cerrar sesión")}
              </span>
            )}

            {user && phone && (
              <IconButton
                aria-label={t("Cerrar sesión") as string}
                title={t("Cerrar sesión") as string}
                size="small"
                onClick={onHandleLogout}
                style={{ color: "var(--ink-900)" }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            )}

            {/* Sustituye al menú de idioma que colgaba de un IconButton
                comentado: el <Menu> seguía en el árbol pero nada podía abrirlo.
                Este es el mismo control que usa BrandHeader. */}
            <span style={phone ? { transform: "scale(0.88)", transformOrigin: "right center" } : undefined}>
              <LangToggle />
            </span>
          </nav>
        </div>
      </header>

      {/* Entrada de archivo oculta. Los botones que la disparaban llevan
          comentados desde antes; se conserva para no cambiar comportamiento en
          una edición que es solo de aspecto. */}
      {user && router.pathname === "/dashboard" && (
        <input
          aria-label="file Input"
          hidden
          ref={hiddenFileInput}
          multiple
          accept=".zip,.rar,.7zip"
          type="file"
          onChange={(e) =>
            onHandleSaveFile(e.target.files ? e.target.files[0] : null)
          }
        />
      )}

      {
        (!user?.plan && isWithinTrial(daysLeft)) && router.pathname == '/dashboard' ?
          <Grid xs={12}>
            <SystemMessage
              image="/images/alert.svg"
              text={t("Tienes")+" "+daysLeft +" "+t("días de prueba gratuitos")}
              alt="Imagen de alerta para recordarte que tu tiempo de prueba está por concluir"
              width={36}
              height={36}
            />
        </Grid>
      : null
      }

      {
        router.pathname == '/dashboard' && phone && (
          <>
            <Box marginBottom={2}>
                <ConversationDrawerBtn
                  drawerButtonOnPress={()=> drawerButtonOnPress()}
                />
              </Box>
            <Spacer css={{ flex: 1 }} />
          </>
        )}

    </>
  );
};
