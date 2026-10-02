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
import { AudioPlayingProvider, ModalProvider } from "../context";
import { aplicarIdiomaDetectado } from "../i18n";
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
                <AudioPlayingProvider>{children}</AudioPlayingProvider>
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

  ReactGA.initialize("G-Y2JN17C4KK");

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