import { FC, useContext, useEffect, useState } from "react";

import Head from "next/head";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Theme, useMediaQuery } from "@mui/material";

import { NavBar } from "../ui";
import { BrandHeader, BrandFooter } from "../ui/BrandChrome";
import { LoadingComponent } from "../ui/LoadingComponent";
import { FirestoreContext, ModalConsumer } from "../../context";
import { ConversationsDrawerMobile } from "../drawers/ConversationsDrawerMobile";
import { usePanelChats } from "../../context/PanelChatsContext";
import { AvisoDeErrores } from "../ui/AvisoDeErrores";
import { useSesion } from "../../hooks/useSesion";
import { PasoBoveda } from "../vault/PasoBoveda";

interface LayoutProps {
  children: JSX.Element | JSX.Element[];
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  const { haySesion } = useSesion();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useContext(FirestoreContext);
  const [title, setTitle] = useState<string>("");
  /* El estado del panel vive ahora en su contexto: ademas de la cabecera, lo
     abre «Ver mis chats» desde la pantalla de inicio (2a), que cuelga de
     DashboardScreen y no es hijo de este componente. */
  const { abierto: openState, alternar, cerrar } = usePanelChats();
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  /* El título de la pestaña, en el idioma de quien navega.
     Estaba fijo en español («Planes», «Pagos», «Mi cuenta») también para
     quien tenía la web en inglés: con cuatro pestañas abiertas, el título es
     lo único por lo que se distingue una de otra, así que era la parte de la
     interfaz donde más molestaba.

     Era además una lista de `if` sueltos, con `/login` dos veces, así que
     ahora es una tabla: añadir una ruta es una línea y no se puede olvidar
     un `else`. El inicio no pasa por `t()` a propósito: es el nombre del
     producto más su descripción para los buscadores, y esa no se traduce. */
  useEffect(() => {
    const titulos: Record<string, string> = {
      "/auth": t("Crear cuenta") as string,
      "/login": t("Entrar") as string,
      "/dashboard": t("Chats") as string,
      "/plans": t("Planes") as string,
      "/payment": t("Pago") as string,
      "/help": t("Ayuda") as string,
      "/account": t("Mi cuenta") as string,
      "/privacyPolicy": t("Política de Privacidad") as string,
      "/termsConditions": t("Términos del Servicio") as string,
      "/": "Backup Reader - Social media backups",
    };
    const nuevo = titulos[router.pathname];
    if (nuevo) setTitle(nuevo);
  }, [router, t, i18n.language]);

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
        {/* Con la sesión iniciada, Ayuda y las páginas legales llevan la
            cabecera de usuario (Mi cuenta · Ayuda · Cerrar sesión), no la
            pública con «Comienza ahora», que a quien ya tiene cuenta no le
            dice nada. */}
        {haySesion && ["/", "/help", "/privacyPolicy", "/termsConditions", "/importancia-de-respaldar-informacion"].includes(router.pathname) ? (
          <BrandHeader app wide />
        ) : ["/privacyPolicy", "/termsConditions", "/importancia-de-respaldar-informacion"].includes(router.pathname) ? (
          <BrandHeader narrow />
        ) : ["/", "/help"].includes(router.pathname) ? (
          <BrandHeader />
        ) : ["/auth", "/login"].includes(router.pathname) ? (
          <BrandHeader minimal />
        ) : ["/plans", "/payment", "/plan-activo"].includes(router.pathname) ? (
          /* /plan-activo (6b) va con la misma cabecera que planes y pago: antes
             caía en la NavBar del panel, con «Conversaciones · 0» en mitad del
             alta. */
          <BrandHeader app />
        ) : router.pathname === "/dashboard" && !phone ? (
          /* Sin cabecera en el dashboard de escritorio (8b): el panel
             lateral lleva el logo, «Agregar chat», la cuenta y el idioma.
             Una barra arriba repetía esos mismos enlaces y le quitaba alto
             a la lectura. */
          null
        ) : (
          <NavBar drawerButtonOnPress={alternar} />
        )}
        <ModalConsumer />

        {/* Hasta ahora los errores de subida y de lectura se guardaban en el
            reducer y no los pintaba nadie. Va en el Layout para que cubra
            todas las rutas, no solo el dashboard. */}
        <AvisoDeErrores />

        {/* Fuera de LoadingComponent a proposito: ver la nota del componente.
            Dentro, cada encendido del spinner global reiniciaba el paso. */}
        <PasoBoveda />

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
        {/* Sin pie en entrar ni crear cuenta cuando se ven en móvil.
            El diseño de esas pantallas (4a, 4b) no lo tiene, y con razón:
            son pantallas de un solo paso, con la acción abajo al alcance del
            pulgar, y debajo del botón aparecían el logo otra vez, dos
            enlaces legales y la razón social. En escritorio sí cabe y se
            queda. */}
        {["/", "/help", "/privacyPolicy", "/termsConditions", "/importancia-de-respaldar-informacion", "/plans", "/payment", "/dashboard"].includes(router.pathname) && (
          <BrandFooter />
        )}
        {["/auth", "/login"].includes(router.pathname) && !phone && <BrandFooter />}
      </div>
    </>
  );
};
