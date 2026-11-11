import "../styles/globals.css";
import "../styles/backupreader-design.css";
import { NextPage } from "next";
import { AppProps } from "next/app";
import { useEffect } from "react";
import { lightheme } from "../themes";
import { Layout } from "../components/layouts";
import { ThemeProvider } from "@mui/material";
import { AuthProvider } from "../context/AuthContext";
import { VaultProvider } from "../context/VaultContext";
import { StorageProvider } from "../context/StorageContext";
import { FirestoreProvider } from "../context/FirestoreContext";
import { LoadingProvider } from "../context/LoadingContext";
import { PanelChatsProvider } from "../context/PanelChatsContext";
import { AudioPlayingProvider, ModalProvider } from "../context";
import i18n, { aplicarIdiomaDetectado } from "../i18n";
import { FirebaseAuth } from "../config/firebase";
import ReactGA from "react-ga4";

type NextPageWithLayout = NextPage & {
  getLayout?: () => JSX.Element;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

/**
 * Orden de providers.
 *
 * VaultProvider va POR ENCIMA de StorageProvider porque `StorageContext`
 * necesita la DEK para cifrar antes de subir. Puede estar arriba sin problema:
 * no depende de ningún otro contexto, escucha `onAuthStateChanged` por su
 * cuenta y habla con Firestore directamente.
 */
const Appstate = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
  return (
    <LoadingProvider>
      <ModalProvider>
        <VaultProvider>
          <FirestoreProvider>
            <StorageProvider>
              <AuthProvider>
                <AudioPlayingProvider>
                  {/* Quien abre el panel de chats: la cabecera y, desde la
                      ronda 2, tambien «Ver mis chats» del inicio. */}
                  <PanelChatsProvider>{children}</PanelChatsProvider>
                </AudioPlayingProvider>
              </AuthProvider>
            </StorageProvider>
          </FirestoreProvider>
        </VaultProvider>
      </ModalProvider>
    </LoadingProvider>
  );
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  /* La detección de idioma corre DESPUÉS de hidratar: i18n arranca con un
     idioma fijo para que servidor y cliente pinten lo mismo. */
  useEffect(() => {
    aplicarIdiomaDetectado();
  }, []);

  /* Los correos que manda Firebase, en el idioma del usuario.
     Sin esto, Firebase usa el idioma por defecto del proyecto —inglés— y
     alguien que tiene toda la aplicación en español recibe en inglés el
     correo de recuperar la contraseña, que es justo el momento en que está
     perdido y menos ganas tiene de traducir. Google traduce sus propias
     plantillas; lo único que hacía falta era decirle qué idioma.

     Va aquí y no dentro de `cambiarIdioma` para no meter Firebase dentro de
     i18n.js, que se carga también en las pruebas y en el render de servidor,
     donde no hay sesión ninguna. */
  useEffect(() => {
    const aplicar = (idioma: string) => {
      try {
        FirebaseAuth.languageCode = (idioma || "es").startsWith("en") ? "en" : "es";
      } catch {
        /* Si Auth aún no está listo, el siguiente cambio de idioma lo pondrá. */
      }
    };
    aplicar(i18n.language);
    i18n.on("languageChanged", aplicar);
    return () => { i18n.off("languageChanged", aplicar); };
  }, []);

  /* GA4 se inicia UNA vez, al montar la aplicación. Antes la llamada estaba en
     el cuerpo del componente y se repetía en cada render de MyApp, y cada
     llamada a `initialize` vuelve a mandar la configuración (y con ella un
     page_view). Flujo de datos de backupreader.com: G-PV00WX4FM0. */
  useEffect(() => {
    ReactGA.initialize("G-PV00WX4FM0");
  }, []);

  return (
    <Appstate>
      <ThemeProvider theme={lightheme}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </ThemeProvider>
    </Appstate>
  );
}

export default MyApp;