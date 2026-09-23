import "../styles/globals.css";
import "../styles/backupreader-design.css";
import { NextPage } from "next";
import { AppProps } from "next/app";
import { lightheme } from "../themes";
import { Layout } from "../components/layouts";
import { ThemeProvider } from "@mui/material";
import { AuthProvider } from "../context/AuthContext";
import { StorageProvider } from "../context/StorageContext";
import { FirestoreProvider } from "../context/FirestoreContext";
import { LoadingProvider } from '../context/LoadingContext';
import { AudioPlayingProvider, ModalProvider } from "../context";
import "../i18n";
import ReactGA from "react-ga4";

type NextPageWithLayout = NextPage & {
  getLayout?: () => JSX.Element;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const Appstate = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
  return (
    <LoadingProvider>
      <ModalProvider>
        <FirestoreProvider>
          <StorageProvider>
            <AuthProvider>
              <AudioPlayingProvider>{children}</AudioPlayingProvider>
            </AuthProvider>
          </StorageProvider>
        </FirestoreProvider>
      </ModalProvider>
    </LoadingProvider>
  );
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  
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
