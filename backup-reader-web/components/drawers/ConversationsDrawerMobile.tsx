import { Fragment, CSSProperties, FC, useContext, useEffect, useState } from "react";
import { bloquearScroll } from "../../lib/bloquear-scroll";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { Text, Button, Collapse } from "@nextui-org/react";
import { StorageContext } from "../../context/StorageContext";
import { AuthContext } from "../../context";
import { LangToggle } from "../ui/BrandChrome";
import { BotonCifrar } from "../vault/BotonCifrar";
import { BotonBorrarChat } from "../chat/BotonBorrarChat";
import { Logo } from "../ui/BrandChrome";
import { nombreDelContacto, iniciales } from "../../lib/nombres-de-chat";
import type { FileList } from "../../models/Files";
import { agruparPorPlataforma } from "../../lib/agrupar-chats";
import type { Plataforma } from "../../lib/agrupar-chats";
import { fechaDeSubida } from "../../lib/fecha-de-guardado";
import { Box, Container, Drawer, Typography } from "@mui/material";
import { storage } from "../../config/firebase";
import { BuscadorDelPanel } from "../chat/BuscadorDelPanel";
import { ResultadosGlobales } from "../chat/ResultadosGlobales";
import { VaultContext } from "../../context/VaultContext";
import {
  ref,
  list,
  ListResult
} from "firebase/storage";


/* Botón con borde en tinta, la mitad del ancho (1b: «Google Drive · Archivos»). */
const botonBorde: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 36,
  padding: "8px 14px",
  background: "transparent",
  color: "var(--ink-900)",
  border: "1.5px solid var(--ink-900)",
  borderRadius: "var(--radius-md, 8px)",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const tileInicial = (activo: boolean): CSSProperties => ({
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-serif)",
  fontSize: 15,
  background: activo ? "var(--ink-900)" : "var(--paper-100)",
  border: activo ? "none" : "1px solid var(--border)",
  color: activo ? "var(--paper-50)" : "var(--ink-900)",
});

const styles = {
  drawerTitle: {
    marginTop: 3,
    letterSpacing: 0.5,
    fontSize: 20,
  },
  drawerSubTitle: {
    color: "#3C3C3C",
    letterSpacing: 0.5,
    fontWeight: "bold",
    fontSize: 10,
  },
};


/** `t()` puede devolver null segun sus tipos; aqui se espera siempre texto. */
const enTextoM = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/* Los enlaces del pie comparten forma: 44px de alto, alineados a la
   izquierda como la lista, y sin aspecto de boton, porque son navegacion y
   no acciones destacadas. */
const enlacePanel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  height: 48,
  padding: "0 8px",
  textAlign: "left",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--ink-900)",
};

type ConversationsDrawerMobileProps = {
  openState: boolean;
  setOpenState: (value: boolean) => void;
};

/* Los mismos nombres de grupo que en escritorio. */
const NOMBRE_DE_PLATAFORMA: Record<Plataforma, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  other: "Otros",
  desconocido: "Sin abrir",
};

export const ConversationsDrawerMobile: FC<ConversationsDrawerMobileProps> = ({
  openState,
  setOpenState,
  
}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  /* El fondo no se desplaza mientras el cajón está abierto: sin esto, el dedo
     que arrastra sobre el cajón mueve la página de detrás. */
  useEffect(() => {
    if (!openState) return;
    return bloquearScroll();
  }, [openState]);
  const { logOut } = useContext(AuthContext);
  const { fileList, chatName, fullPath: rutaAbierta } = useContext(StorageContext);
  /* Lo que se escribe en «Buscar en todos los chats» del panel. */
  const [consultaPanel, setConsultaPanel] = useState("");
  const buscandoEnPanel = consultaPanel.trim().length > 0;
  const { status: estadoBoveda } = useContext(VaultContext);
  const { getFile } = useContext(StorageContext);
  const onHandleGetFile = (fullPath: string, name: string) => {
    getFile(fullPath, name);
    setOpenState(false);
  };


  function extractUsername(instagramString: string): string {
    if (!instagramString.includes('_')) {
        return instagramString;
    }
    
    const parts = instagramString.split('_');
    const username = parts[0];

    if (username.includes(' ')) {
        return instagramString;
    }
    return username;
  }




  /* Aquí vivía el listado de conversaciones de un backup de Instagram subido
     entero, de la época v1. Ahora la conversación se elige antes de subir y lo
     que se guarda es una sola, como un chat de WhatsApp. Estaba muerto, pero
     revivía con cualquier chat cuyo nombre llevara «instagram-» dentro. */


  const [confirmando, setConfirmando] = useState(false);

  /* Agrupados por plataforma, con las mismas reglas que en escritorio: ver
     `lib/agrupar-chats.ts`. */
  const { grupos, conCabecera } = agruparPorPlataforma(fileList);

  /**
   * Una fila de la lista. Antes era el cuerpo de un `map`; se saca a una
   * función porque ahora la lista se pinta por grupos.
   */
  const pintarChat = (item: FileList, i: string | number) => {

    /* El botón de cifrar va FUERA del <Button>, no dentro: un botón
       anidado en otro es HTML inválido y el clic se vuelve impredecible.
       Por eso la fila pasa a ser un div con los dos al lado. */
    /* Fila de chat (pantalla 1b).
       Antes era un <Button> de NextUI con el nombre crudo del archivo en
       10px: "Chat de WhatsApp con Mama Tue, Sep 15, 2026, 07 PM". Eso no
       se lee de un vistazo y, con varios chats, todos empiezan igual, asi
       que hay que leer hasta el final de cada uno para distinguirlos.
       Ahora: iniciales, nombre del contacto y la fecha debajo. */
    /* Bóveda cerrada (4d): el chat existe pero su nombre vive dentro
       del manifiesto cifrado. Llegaba con name "" y salía como una fila
       vacía, sin iniciales, que se podía tocar para abrir (y fallar) y
       que tenía papelera. Ahora se pinta con candado y no se abre, igual
       que en el panel de escritorio. */
    if (item.bloqueado) {
      return (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", minHeight: 58, borderRadius: 8 }}
        >
          <span aria-hidden style={{ ...tileInicial(false), color: "var(--slate-500)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--slate-500)" }}>
            {t("Chat cifrado")}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--slate-500)" }}>
            {t("Bloqueado")}
          </span>
        </div>
      );
    }

    const nombre = nombreDelContacto(item.name);
    /* Por ruta: dos versiones del mismo chat se llaman igual. */
    const activo = rutaAbierta ? rutaAbierta === item.fullPath : chatName === item.name;

    return  (
      <div
        key={i}
        data-fila-chat
        onClick={() => onHandleGetFile(item.fullPath, item.name)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 0 8px 8px",
          minHeight: 58,
          borderRadius: 8,
          cursor: "pointer",
          background: activo ? "var(--brass-100)" : "transparent",
        }}
      >
        <span aria-hidden style={tileInicial(activo)}>
          {iniciales(nombre)}
        </span>

        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink-900)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nombre}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--slate-500)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textTransform: item.creadoEn ? "uppercase" : undefined,
            }}
          >
            {/* Fecha y hora de subida en vez del .zip: distingue las
                versiones del mismo chat. Los antiguos sin fecha, el archivo. */}
            {item.creadoEn
              ? ((t("Subido {{fecha}}", { fecha: fechaDeSubida(item.creadoEn, i18n.language || "es") }) as unknown as string) ?? "")
              : item.name}
          </span>
        </span>

        {!item.cifrado && (
          <BotonCifrar fullPath={item.fullPath} name={item.name} />
        )}
        <BotonBorrarChat fullPath={item.fullPath} name={item.name} onConfirmando={setConfirmando} />
      </div>
    )
  };

  return (
    <Drawer
      anchor={"left"}
      open={openState}
      onClose={() => setOpenState(false)}
      /* MUI bloquea el desplazamiento del fondo poniendo «overflow: hidden»
         en el body, y ese candado se queda puesto. Con el body así, él pasa a
         ser el contenedor de desplazamiento de todo lo de dentro, y como no
         se desplaza, CUALQUIER «position: sticky» de la aplicación deja de
         pegarse sin decir nada: es lo que hacía que la barra de resultados
         del chat se fuera de la vista al bajar, en un sitio sin ninguna
         relación aparente con este cajón.

         Se le quita el suyo y se pone el nuestro, que lleva cuenta y se
         suelta cuando lo suelta el último. */
      ModalProps={{ disableScrollLock: true }}
      /* El velo va en tinta y no en el gris del navegador: el gris de serie
         enfria toda la pantalla y rompe el papel calido del resto. */
      slotProps={{ backdrop: { style: { backgroundColor: "rgba(15,24,38,0.55)" } } }}
      /* Mientras se confirma un borrado el panel se aparta y queda solo la
         hoja de confirmar sobre el velo (9b). Se esconde, no se cierra:
         cerrarlo desmontaría el diálogo, que vive dentro. */
      PaperProps={{ style: { width: 322, background: "var(--paper-50)", visibility: confirmando ? "hidden" : "visible" } }}
    >
      <Container style={{ width: 322, padding: 0, minHeight: "100%", display: "flex", flexDirection: "column" }}>
        <Box
          paddingLeft={"16px"}
          paddingRight={"8px"}
          height={60}
          flexShrink={0}
          display={"flex"}
          alignItems={"center"}
          justifyContent={"space-between"}
          borderBottom={"1px solid var(--border)"}
        >
          <Logo compact onClick={() => { setOpenState(false); router.push("/dashboard"); }} />
          {/* Cerrar el panel desde dentro: en un telefono grande el borde
              derecho de la pantalla no siempre llega con el pulgar. */}
          <button
            type="button"
            aria-label={enTextoM(t("Cerrar"))}
            onClick={() => setOpenState(false)}
            style={{
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-900)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </Box>

        {/* Sin buscador aquí (1b). El buscador general vive en el inicio
            (3a), que es donde hay ancho para leer los resultados; en un panel
            de 322px los mensajes encontrados se cortaban a dos palabras. */}

        {/* Cuantos chats hay (1b). Sin el contador, una lista larga no dice
            si estan todos: el usuario que subio diez y ve seis en pantalla no
            sabe si faltan cuatro o si hay que desplazarse. */}
        {/* Buscar en todos los chats, encima de la lista, como en WhatsApp.
            Con texto, la lista se cambia por contactos y mensajes; al tocar
            un resultado se abre el chat y el panel se cierra (onHandleGetFile). */}
        {(fileList?.length ?? 0) > 0 && (
          <BuscadorDelPanel
            consulta={consultaPanel}
            onConsulta={setConsultaPanel}
            bloqueado={estadoBoveda === "locked"}
            style={{ margin: "16px 16px 0" }}
          />
        )}

        {buscandoEnPanel && (
          <div style={{ padding: "12px 16px 16px" }}>
            <ResultadosGlobales consulta={consultaPanel} alAbrirChat={onHandleGetFile} />
          </div>
        )}

        <p
          style={{
            margin: 0,
            padding: "20px 16px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--slate-500)",
            display: buscandoEnPanel ? "none" : undefined,
          }}
        >
          {enTextoM(t("Tus chats · {{n}}", { n: fileList?.length ?? 0 }))}
        </p>

        <div style={{ display: buscandoEnPanel ? "none" : "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {grupos.map(({ plataforma, chats }) => (
          <Fragment key={plataforma}>
            {conCabecera && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--slate-400)",
                  margin: "10px 0 2px",
                }}
              >
                {enTextoM(t(NOMBRE_DE_PLATAFORMA[plataforma]))}
              </p>
            )}
            {chats.map((item, i) => pintarChat(item, plataforma + i))}
          </Fragment>
        ))}        </div>


        {/* Lo que el panel tenia que ofrecer ademas de la lista (1b).
            Estaba todo en la cabecera de la aplicacion, que en movil se
            queda detras del panel: con el panel abierto no habia forma de
            agregar un chat ni de llegar a la cuenta sin cerrarlo antes. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "24px 16px 0" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--slate-500)",
            }}
          >
            {t("Agregar chat")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setOpenState(false);
                window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "drive" }));
              }}
              style={botonBorde}
            >
              {t("Google Drive")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenState(false);
                window.dispatchEvent(new CustomEvent("br:subir-chat", { detail: "archivos" }));
              }}
              style={botonBorde}
            >
              {t("Archivos")}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />

        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)", padding: "8px 8px 28px" }}>
          {/* El idioma, junto a la cuenta (10a).
              Estaba en la cabecera, compitiendo con el botón de
              conversaciones encima de la conversación que se está leyendo.
              Aquí está donde vive el resto de lo que configura el usuario, y
              se toca una vez al año. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 12px 12px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--slate-500)",
              }}
            >
              {t("Idioma")}
            </span>
            <LangToggle />
          </div>

          <button
            type="button"
            onClick={() => { setOpenState(false); router.push("/account"); }}
            style={enlacePanel}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9.5" />
              <circle cx="12" cy="10" r="3" />
              <path d="M6.2 18.4a6.5 6.5 0 0 1 11.6 0" />
            </svg>
            {t("Mi cuenta")}
          </button>
          <button
            type="button"
            onClick={() => { setOpenState(false); logOut(); }}
            style={{ ...enlacePanel, color: "var(--slate-700)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            {t("Cerrar sesión")}
          </button>
        </div>
      </Container>
    </Drawer>
  );
};
