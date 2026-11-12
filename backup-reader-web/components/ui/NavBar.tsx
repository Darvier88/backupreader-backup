import { FC, useContext, useEffect, useRef } from "react";

import { Spacer, Grid } from "@nextui-org/react";
import { AuthContext, FirestoreContext } from "../../context";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { FirebaseAuth } from "../../config/firebase";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
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
 * Antes era una barra azul (var(--ink-900)) con el logo en PNG, mientras el dashboard
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
  const { saveFile, fileList } = useContext(StorageContext);
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


  /* En el movil del dashboard, la cuenta y cerrar sesion viven en el panel de
     chats (1b), no en la cabecera. El diseno deja arriba solo lo que pertenece
     al chat que se esta leyendo; dos iconos de cuenta encima de una
     conversacion compiten con ella y ademas empujaban el titulo del chat a una
     segunda linea en pantallas de 360 px. Fuera del dashboard siguen aqui,
     porque alli no hay panel donde ponerlos y quitarlos dejaria sin salida. */
  const enElPanel = router.pathname === "/dashboard";

  /* Cuántos chats hay, para el botón y para decidir si sale.
     Sin chats la cabecera es solo el logo y el idioma (2b, 5c): un botón
     que dice «Conversaciones · 0» y abre un panel vacío es peor que no
     tener botón. */
  const cuantosChats = fileList?.length ?? 0;

  return (
    <>
      <header className="br-header">
        {/* maxWidth 1360: el mismo que usa BrandHeader en el dashboard, para
            que el logo caiga a la misma altura en las dos pantallas. */}
        <div className="br-header-inner" style={{ maxWidth: 1360 }}>
          {/* El panel se abre ahora con el botón «Conversaciones · N» de la
              derecha (10a), no con un icono. Un icono de panel no dice
              cuántos chats hay ni que sean tuyos; el botón dice las dos
              cosas y además es un objetivo mucho más fácil de acertar. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
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

          </div>

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

            {/* "Mi cuenta": en escritorio como enlace de texto, igual que
                BrandHeader. En móvil no cabe junto al resto —la cabecera se
                partía en dos filas—, así que va como icono, el mismo trato que
                tiene ya cerrar sesión. */}
            {user && !phone && router.pathname !== "/account" && (
              <span
                className="br-navlink"
                style={enlace}
                onClick={() => router.push("/account")}
              >
                {t("Mi cuenta")}
              </span>
            )}

            {user && phone && !enElPanel && router.pathname !== "/account" && (
              <IconButton
                aria-label={t("Mi cuenta") as string}
                title={t("Mi cuenta") as string}
                size="small"
                onClick={() => router.push("/account")}
                style={{ color: "var(--ink-900)" }}
              >
                <AccountCircleOutlinedIcon fontSize="small" />
              </IconButton>
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

            {user && phone && !enElPanel && (
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

            {/* «Conversaciones · N» (10a).
                Sale en todas las pantallas con chats: el inicio, el inicio
                bloqueado y la vista de chat. Lleva el número porque es lo
                que convierte un botón de navegación en una respuesta: el
                usuario sabe cuántos tiene sin abrir nada. */}
            {user && phone && enElPanel && cuantosChats > 0 && (
              <button
                type="button"
                className="br-btn br-btn-ghost br-btn-sm"
                onClick={() => drawerButtonOnPress()}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, whiteSpace: "nowrap" }}
              >
                {t("Conversaciones")}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 22,
                    height: 22,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "var(--ink-900)",
                    color: "var(--paper-50)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  {cuantosChats}
                </span>
              </button>
            )}

            {/* Sustituye al menú de idioma que colgaba de un IconButton
                comentado: el <Menu> seguía en el árbol pero nada podía abrirlo.
                Este es el mismo control que usa BrandHeader. */}
            {/* Sin encoger el selector de idioma.
                Llevaba `scale(0.88)` en movil para ganar sitio en la cabecera,
                y eso dejaba sus botones en 35px reales aunque el CSS pidiera
                40: un escalado reduce el area pulsable igual que reduce el
                dibujo, asi que el dedo tiene que acertar en 35.
                El sitio que se ganaba ya no hace falta: la cabecera ahora
                puede pasar a dos lineas en pantallas estrechas. */}
            {/* El idioma se va al panel cuando hay chats (10a): allí vive
                junto a la cuenta, y aquí arriba dejaba la cabecera con tres
                controles compitiendo encima de una conversación. Sin chats
                (2b, 5c) no hay panel al que mandarlo y se queda. */}
            {!(user && phone && enElPanel && cuantosChats > 0) && (
              <span>
                <LangToggle />
              </span>
            )}
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
              /* Vacío a propósito: el icono es decorativo y el texto de al
                 lado ya dice lo mismo. Un lector de pantalla que lea las dos
                 cosas repite el aviso dos veces seguidas. */
              alt=""
              width={36}
              height={36}
            />
        </Grid>
      : null
      }

      {/* El botón «< Chats» que iba aquí, en una fila aparte, ahora vive en
          la cabecera (ver arriba). */}

    </>
  );
};
