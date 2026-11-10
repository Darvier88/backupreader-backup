import { FC, useContext, useEffect, useState } from "react";

import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Theme, useMediaQuery } from "@mui/material";

import { NavBar } from "../ui";
import { BrandHeader, BrandFooter } from "../ui/BrandChrome";
import { LoadingComponent } from "../ui/LoadingComponent";
import { FirestoreContext, ModalConsumer } from "../../context";
import { ConversationsDrawerMobile } from "../drawers/ConversationsDrawerMobile";
import { usePanelChats } from "../../context/PanelChatsContext";
import { AvisoDeErrores } from "../ui/AvisoDeErrores";

interface LayoutProps {
  children: JSX.Element | JSX.Element[];
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user } = useContext(FirestoreContext);
  const [title, setTitle] = useState<string>("");
  /* El estado del panel vive ahora en su contexto: ademas de la cabecera, lo
     abre «Ver mis chats» desde la pantalla de inicio (2a), que cuelga de
     DashboardScreen y no es hijo de este componente. */
  const { abierto: openState, alternar, cerrar } = usePanelChats();
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  useEffect(() => {
    if (router.pathname === "/auth") {
      setTitle("Registro");
    }
    if (router.pathname === "/login") {
      setTitle("Login");
    }
    if (router.pathname === "/dashboard") {
      setTitle("Chats");
    }
    if (router.pathname === "/login") {
      setTitle("Login");
    }
    if (router.pathname === "/plans") {
      setTitle("Planes");
    }
    if (router.pathname === "/payment") {
      setTitle("Pagos");
    }
    if (router.pathname === "/help") {
      setTitle("Ayuda");
    }
    if (router.pathname === "/account") {
      setTitle("Mi cuenta");
    }
    if (router.pathname === "/") {
      setTitle("Backup Reader - Social media backups");
    }
    if (router.pathname === "/privacyPolicy") {
      setTitle("Política de Privacidad");
    }
    if (router.pathname === "/termsConditions") {
      setTitle("Términos del servicio");
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="author" content="Backup Reader, LLC" />
        <meta
          name="description"
          content="Backup para chats de whatsapp"
        />
        <meta
          name="keywords"
          content="whatsapp, backup, respaldo, nube, conversacion, instagram, cloud"
        />
      </Head>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--paper-50)" }}>
        {["/privacyPolicy", "/termsConditions", "/importancia-de-respaldar-informacion"].includes(router.pathname) ? (
          <BrandHeader narrow />
        ) : ["/", "/help"].includes(router.pathname) ? (
          <BrandHeader />
        ) : ["/auth", "/login"].includes(router.pathname) ? (
          <BrandHeader minimal />
        ) : ["/plans", "/payment"].includes(router.pathname) ? (
          <BrandHeader app />
        ) : router.pathname === "/dashboard" && !phone ? (
          <BrandHeader app wide />
        ) : (
          <NavBar drawerButtonOnPress={alternar} />
        )}
        <ModalConsumer />

        {/* Hasta ahora los errores de subida y de lectura se guardaban en el
            reducer y no los pintaba nadie. Va en el Layout para que cubra
            todas las rutas, no solo el dashboard. */}
        <AvisoDeErrores />

        <ConversationsDrawerMobile
          openState={openState}
          setOpenState={(v: boolean) => (v ? alternar() : cerrar())}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <LoadingComponent>
            <main
              style={{
                padding: "0px,20px",
              }}
            >
              {children}
            </main>
          </LoadingComponent>
        </div>
        {["/", "/help", "/privacyPolicy", "/termsConditions", "/importancia-de-respaldar-informacion", "/auth", "/login", "/plans", "/payment", "/dashboard"].includes(router.pathname) && (
          <BrandFooter />
        )}
      </div>
    </>
  );
};
