import { FC, Fragment, useCallback, useContext, useState, useEffect, useMemo, useRef } from "react";

import {
  Box,
  Button,
  Container,
  Theme,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Grid, Loading } from "@nextui-org/react";
import { ChatView } from "../chat";
import { ManageFileCard } from "../cards";
import { ConversationsDrawer } from "../drawers";
import type { Terminos } from "../../lib/busqueda/resaltar";
import { BuscadorEnChat } from "../chat/BuscadorEnChat";
import { FiltroDelAnalisis } from "../chat/FiltroDelAnalisis";
import { ControlSegmentado } from "../ui/ControlSegmentado";
import { cuantasVeces } from "../../lib/busqueda/resaltar";
import { claveDeDia, etiquetaDeDia } from "../../lib/fechas-de-chat";
import { nombreDelContacto } from "../../lib/nombres-de-chat";
import { usePanelChats } from "../../context/PanelChatsContext";
import { pedirBusqueda } from "../../lib/pedir-busqueda";
import { fechaDeSubida } from "../../lib/fecha-de-guardado";
import { ANALISIS_ACTIVO } from "../../lib/analisis/activo";
import { aMarcaDeTiempo, deducirFormato } from "../../lib/analisis/fechaHora";
import { duracion, numero } from "../../lib/analisis/formatear";
import { PanelAnalisis } from "../analisis/PanelAnalisis";

/** `t()` puede devolver null segun sus tipos; esto lo deja en string. */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";
import { StorageContext } from "../../context/StorageContext";
import { useLoading } from "../../context/LoadingContext";
import useInView from "../../hooks/useInView";
import { documentoAdjunto } from "../../lib/nombre-de-adjunto";
import i18n, { t } from "i18next";



// Separa "Nombre  Tue, Sep 15, 2026, 07 PM" en { name, date }.
// Extrae el nombre del contacto (el "otro") del título del chat.
function extractContact(chatName: string): string {
  if (!chatName) return "";
  const base = splitChatName(chatName).name;
  return base
    .replace(/^Chat de WhatsApp con\s+/i, "")
    .replace(/^WhatsApp Chat -\s+/i, "")
    .replace(/^Chat con\s+/i, "")
    .trim();
}

function splitChatName(full: string): { name: string; date: string } {
  if (!full) return { name: "", date: "" };
  const m = full.match(/^(.*?)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+.*(?:AM|PM))\s*$/i);
  if (m) {
    const date = m[2].trim().replace(/,\s*(\d{1,2}\s*[AP]M)\s*$/i, " \u00b7 $1");
    return { name: m[1].trim(), date };
  }
  return { name: full, date: "" };
}

// Tipo + nombre de archivo para la vista de Media.
function mediaMeta(message: string): { kind: string; filename: string } {
  const m = (message || "").replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "");
  const fileMatch = m.match(/([^\s:<>]+\.[a-z0-9]{2,4})\b/i);
  const filename = fileMatch ? fileMatch[1] : m.trim();
  const ext = (filename.split(".").pop() || "").toLowerCase();
  let kind = "Documento";
  if (/^(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/.test(ext)) kind = "Foto";
  else if (/^(opus|mp3|m4a|aac|wav|ogg|flac)$/.test(ext)) kind = "Audio";
  else if (/^(mp4|mov|avi|mkv|webm|3gp|wmv|flv)$/.test(ext)) kind = "Video";
  return { kind, filename };
}

const styles = {
  chatContainer: {
    display: "flex",
    backgroundColor: "var(--paper-50)",
  },
  drawerContainer: {
    alignSelf: "stretch",
    padding: 0,
    display: "flex",
    backgroundColor: "var(--paper-100)",
    borderRight: "1px solid var(--border)",
  },
};

/** Media hora: por debajo, una etiqueta por mensaje taparía el chat. */
const ESPERA_MINIMA_MS = 30 * 60 * 1000;

const ETIQUETA_ESPERA = {
  segundos: "{{valor}} s",
  minutos: "{{valor}} min",
  horas: "{{valor}} h",
  dias: "{{valor}} días",
} as const;

const numeroCorto = (n: number) => numero(n, i18n.language || "es");

export const DashboardScreen: FC = () => {
  const [chatSearch, setChatSearch] = useState<string>("");
  const { getFile, chat, chatName, uploadStatus, cerrarChat, fullPath: rutaAbierta } = useContext(StorageContext);
  const { loading } = useLoading();
  const [toShow, setToShow] = useState<"photos" | "message" | "analisis">("message");

  /* Los tiempos de respuesta dentro del chat.
     Apagados por defecto: quien abre un chat viene a leerlo, y una etiqueta
     cada pocos mensajes cambia la lectura sin que nadie lo haya pedido. */
  const [mostrarEsperas, setMostrarEsperas] = useState(false);

  /* El análisis AL LADO del chat, en escritorio.
     En el móvil no cabe y sigue siendo una pestaña; aquí sí cabe, y verlo
     al lado es lo que deja comprobar una cifra sin perder de vista los
     mensajes de los que habla. Apagado por defecto: quien abre un chat
     viene a leerlo. */
  const [panelLateral, setPanelLateral] = useState(false);

  /* El filtro que viene del análisis (pantalla 1g).
     Tocar «perdona · 26» no debería dejarte en un mensaje suelto: lo que
     hace falta es ver los 26 y poder recorrerlos. Reusa el contador y las
     flechas de la búsqueda del chat, que ya existen y ya funcionan; lo
     único nuevo es que la consulta puede ser una lista de palabras,
     porque «disculpas» no es una palabra sino tres. */
  const [filtro, setFiltro] = useState<{
    etiqueta: string;
    terminos: Terminos;
    /** Si se da, solo cuentan los mensajes de esta persona. */
    autor?: string;
  } | null>(null);

  /* Qué se marca DENTRO de una burbuja. Con el filtro de una persona, en
     los mensajes de los demás no se marca nada, o el texto contradiría al
     contador de arriba: subrayaría «gracias» en mensajes que la cifra no
     cuenta. */
  const consultaDe = (autorDeLaFila: string): Terminos =>
    filtro?.autor && (autorDeLaFila || "").trim() !== filtro.autor
      ? ""
      : consultaActiva;

  /* Lo que se busca ahora mismo: el filtro manda sobre lo tecleado. */
  const consultaActiva: Terminos = filtro ? filtro.terminos : chatSearch;

  /* Al cambiar de chat el filtro se cae: «❤️ · 3 de 11» encima de otra
     conversación cuenta otra cosa, y la etiqueta diría que no. */
  useEffect(() => {
    setFiltro(null);
  }, [rutaAbierta]);

  /* El formato de fecha, deducido una vez por chat. Hace falta para restar
     dos mensajes, y deducirlo por mensaje sería recorrer el chat entero en
     cada fila. */
  const formatoFecha = useMemo(
    () => deducirFormato((chat || []) as string[][]),
    [chat]
  );

  /** Milisegundos entre dos mensajes, si pasa del mínimo y cambia de autor. */
  const esperaEntre = useCallback(
    (anterior: any, actual: any): number | null => {
      /* Entre dos mensajes de la misma persona no hay respuesta que medir:
         es alguien que sigue escribiendo. */
      if (!anterior || !actual || anterior[1] === actual[1]) return null;
      const a = aMarcaDeTiempo(anterior[0], formatoFecha);
      const b = aMarcaDeTiempo(actual[0], formatoFecha);
      if (!a || !b) return null;
      const ms = b.getTime() - a.getTime();
      return ms >= ESPERA_MINIMA_MS ? ms : null;
    },
    [formatoFecha]
  );
  const [state, setState] = useState<boolean>(true);
  const { fileList } = useContext(StorageContext);
  const {
    objetivo,
    limpiarObjetivo,
    desdeResultados,
    setDesdeResultados,
    setConsulta: setConsultaGlobal,
    setPorChat,
    setChatFiltro,
    setVistaCompleta,
  } = usePanelChats();

  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  // ---- Render incremental de mensajes ----
  // Renderizar TODOS los mensajes de golpe congela la pestaña en chats pesados.
  // En su lugar mostramos bloques y vamos cargando más al hacer scroll.
  const CHUNK = 60;
  const [visibleCount, setVisibleCount] = useState<number>(CHUNK);
  /* En qué coincidencia de la búsqueda está el usuario ahora mismo. */
  const [activa, setActiva] = useState<number>(0);

  // Lista ya filtrada según la pestaña (mensajes / solo media).
  const visibleMessages = useMemo(
    () =>
      (chat || []).filter((item: any) => {
        if (toShow === "photos") {
          const m = (item[2] || "").toLowerCase();
          const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)\b/.test(m);
          const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv)\b/.test(m);
          const isAudio = /\.(opus|mp3|m4a|aac|wav|ogg)\b/.test(m);
          /* Los documentos (PDF, Word, Excel…) también son media: los trae el
             export y antes no salían en esta pestaña. */
          return isImage || isVideo || isAudio || !!documentoAdjunto(item[2]);
        }
        return true;
      }),
    [chat, toShow]
  );

  /* Coincidencias de la búsqueda dentro del chat (pantalla 1c).
   *
   * Se numeran de corrido sobre TODO el chat, no sobre lo que está pintado:
   * el contador dice "2 de 17" y esas 17 tienen que ser las del chat entero,
   * no las de los primeros 60 mensajes. Para cada mensaje se guarda en qué
   * número empieza, que es lo que permite a cada burbuja saber si alguna de
   * sus marcas es la activa sin volver a contar.
   */
  const coincidencias = useMemo(() => {
    const porMensaje: number[] = [];
    const desplazamientos: number[] = [];
    let acumulado = 0;

    const hayQueBuscar = filtro
      ? !Array.isArray(filtro.terminos) || filtro.terminos.length > 0
      : chatSearch.trim().length >= 2;
    if (!hayQueBuscar) {
      return { porMensaje, desplazamientos, total: 0 };
    }

    for (const item of visibleMessages) {
      /* Con el filtro de una persona, los mensajes de los demás no cuentan:
         tocar «Yasmín · 3» y que salgan los 8 del grupo convierte un dato
         sobre ella en uno sobre todos, que es justo lo que no se pidió. */
      const deOtro =
        !!filtro?.autor && ((item as any)[1] || "").trim() !== filtro.autor;
      const n = deOtro ? 0 : cuantasVeces((item as any)[2] || "", consultaActiva);
      desplazamientos.push(acumulado);
      porMensaje.push(n);
      acumulado += n;
    }

    return { porMensaje, desplazamientos, total: acumulado };
  }, [visibleMessages, chatSearch, filtro, consultaActiva]);

  /* En qué mensaje vive la coincidencia activa. Hace falta para dos cosas:
     ampliar la lista si está más allá de lo pintado, y desplazarse hasta ella. */
  const mensajeDeLaActiva = useMemo(() => {
    if (coincidencias.total === 0) return -1;
    for (let i = coincidencias.porMensaje.length - 1; i >= 0; i--) {
      if (coincidencias.porMensaje[i] > 0 && coincidencias.desplazamientos[i] <= activa) {
        return i;
      }
    }
    return -1;
  }, [coincidencias, activa]);

  /* Saltar a una coincidencia que todavía no se ha pintado no haría nada: el
     elemento no existe en el DOM. Se amplía la lista hasta incluirla. */
  useEffect(() => {
    if (mensajeDeLaActiva >= visibleCount) {
      setVisibleCount(Math.ceil((mensajeDeLaActiva + 1) / CHUNK) * CHUNK);
    }
  }, [mensajeDeLaActiva, visibleCount]);

  /* Llegada desde un resultado de la busqueda global: se trae lo buscado y el
     numero de mensaje. Se espera a que el chat este cargado y a que se hayan
     contado las coincidencias, porque hasta entonces no se sabe que numero de
     coincidencia global le toca a ese mensaje. */
  useEffect(() => {
    if (!objetivo || !chat) return;
    if (chatSearch !== objetivo.consulta) {
      setChatSearch(objetivo.consulta);
      return;
    }
    const desplazamiento = coincidencias.desplazamientos[objetivo.mensaje];
    if (desplazamiento === undefined) return;
    setActiva(desplazamiento);
    limpiarObjetivo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo, chat, chatSearch, coincidencias]);

  /* Desplazarse hasta la marca activa. Va en un efecto y no en el manejador de
     la flecha porque el elemento puede no existir todavía: si el salto obligó
     a ampliar la lista, React tiene que pintarla primero. */
  useEffect(() => {
    if (coincidencias.total === 0) return;
    const marca = document.querySelector(`[data-coincidencia="${activa}"]`);
    marca?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activa, coincidencias.total, visibleCount]);

  // En chats de 2 personas, "tú" = el remitente que NO es el contacto del título.
  const myName = useMemo(() => {
    const senders = Array.from(
      new Set((chat || []).map((it: any) => (it[1] || "").trim()).filter((n: string) => n.length > 0))
    );
    if (senders.length !== 2) return "";
    const contact = extractContact(chatName || "").toLowerCase();
    if (!contact) return "";
    const other = senders.find(
      (s) => s.toLowerCase().includes(contact) || contact.includes(s.toLowerCase())
    );
    if (!other) return "";
    return senders.find((s) => s !== other) || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, chatName]);

  // Al cambiar de chat, de pestaña o de búsqueda, reiniciar el conteo.
  useEffect(() => {
    setVisibleCount(CHUNK);
  }, [chat, toShow, chatSearch, filtro]);

  // Centinela al final de la lista: cuando se acerca a la vista, carga más.
  // Es más robusto que escuchar el scroll de un contenedor concreto, porque
  // funciona sin importar cuál sea el elemento que hace scroll.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sentinelInView = useInView(sentinelRef, "300px");

  useEffect(() => {
    if (sentinelInView && visibleCount < visibleMessages.length) {
      setVisibleCount((c) => Math.min(c + CHUNK, visibleMessages.length));
    }
  }, [sentinelInView, visibleCount, visibleMessages.length]);


  const onHandleGetFile = (fullPath: string, name: string) => {
    /* Abrir desde el panel no viene de un resultado: sin «‹ Resultados». */
    setDesdeResultados(false);
    getFile(fullPath, name);
  };

  /* La búsqueda general se guarda al abrir un chat SOLO si se abrió desde un
     resultado en escritorio, para que «‹ Resultados» vuelva a ella (11b). En
     cualquier otro caso se limpia, como antes: en el móvil el buscador se
     queda como estaba. */
  useEffect(() => {
    if (!chat) return;
    if (phone || !desdeResultados) {
      setConsultaGlobal("");
      setPorChat({});
      setChatFiltro(null);
      setVistaCompleta(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  const volverAResultados = () => {
    setVistaCompleta(true);
    setDesdeResultados(false);
    cerrarChat();
  };

  const onHandleSearch = (value: string) => {
    setChatSearch(value);
  };

  const filterToShow = (message: string) => {
    if (toShow === "photos") {
      if (
        message?.includes(".opus>") ||
        message?.includes(".jpg>") ||
        message?.includes(".mp4>")
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  };

  
  useEffect(() => {
    if (fileList?.length === 0) {
      setState(true);
    } else {
      setState(false);
    }
  }, [fileList]);
 
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
 

  /* ⌘K con un chat abierto.
     El buscador general vive en el inicio (8b), así que desde un chat no hay
     ningún campo que enfocar. En vez de no hacer nada —y dejar al usuario
     pulsando un atajo que la aplicación ignora— se cierra el chat, que es lo
     que deja el buscador delante. */
  useEffect(() => {
    if (!chat) return;
    const alPulsar = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const escribiendo =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !escribiendo) {
        e.preventDefault();
        pedirBusqueda();
        cerrarChat();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [chat]);

  /* En el móvil, al enfocar la búsqueda toma la cabecera (1c). */
  const [buscando, setBuscando] = useState(false);
  const ocultarCabecera = phone && buscando;

  /* El panel, montado una sola vez: la pestaña del móvil y la columna de
     escritorio pintan exactamente lo mismo. */
  const elAnalisis = (
    <PanelAnalisis
      filas={(chat || []) as string[][]}
      handle={rutaAbierta}
      /* El mismo nombre que enseña la cabecera del chat, con la misma
         limpieza: `chatName` trae el prefijo «Chat de WhatsApp con», la
         extensión y a veces una fecha pegada, y lo que hay que comparar es
         contra el remitente que firma los avisos, que es el nombre pelado. */
      nombreChat={
        nombreDelContacto(splitChatName(extractUsername(chatName || "")).name) ||
        splitChatName(extractUsername(chatName || "")).name
      }
      yoPorDefecto={myName}
      /* Tocar un emoji o una palabra lleva al mensaje. Con el panel al
         lado no hace falta cambiar de vista; en la pestaña del móvil sí. */
      /* Tocar una cifra deja el chat marcado con lo que la produjo (1g).
         Se pone antes de saltar: así el salto aterriza con la barra puesta
         y el recuento ya hecho. */
      onFiltrar={(etiqueta, terminos, autor) => {
        setChatSearch("");
        setFiltro({ etiqueta, terminos, autor });
        setActiva(0);
        /* En el móvil el análisis ocupa la pantalla entera: sin esto, tocar
           una palabra filtraría un chat que no se está viendo y no pasaría
           nada a ojos de quien lo tocó. */
        if (!panelLateral) setToShow("message");
      }}
      onIrAlMensaje={(indice) => {
        if (!panelLateral) setToShow("message");
        setVisibleCount((c) => Math.max(c, indice + CHUNK));
        window.setTimeout(() => {
          const fila = document.querySelector(`[data-mensaje="${indice}"]`);
          fila?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 120);
      }}
    />
  );

  /* Alto del chat abierto: desde donde empieza la columna hasta el borde de
     abajo de la pantalla, igual que el panel de chats, que ocupa la pantalla
     entera. Antes era un 85vh fijo: en escritorio quedaba un hueco debajo del
     chat (680 px frente a los 800 del panel) y en móvil sobraban ~60 px.
     Se mide en vez de restar la cabecera a mano porque esa cabecera cambia:
     en escritorio no hay, en móvil sí, y al buscar en el chat se esconde. */
  const inicioColumna = useRef<HTMLDivElement>(null);
  const [altoChat, setAltoChat] = useState<number | null>(null);
  useEffect(() => {
    if (!chat) return;
    const medir = () => {
      const marca = inicioColumna.current;
      if (!marca) return;
      const arriba = marca.getBoundingClientRect().top + window.scrollY;
      setAltoChat(Math.max(320, Math.round(window.innerHeight - arriba)));
    };
    medir();
    /* Un fotograma después también: la cabecera móvil se esconde o aparece
       justo al cambiar `ocultarCabecera`, y hay que medir ya colocada. */
    const fotograma = requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      cancelAnimationFrame(fotograma);
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, [chat, ocultarCabecera, phone]);

  return (
    <Grid.Container style={{ minHeight: "100vh", background: "var(--paper-50)", maxWidth: 1360, margin: "0 auto", width: "100%" }}>
      
      {!phone && (
        <Grid
          xs={3.5}
          md={3.5}
          style={{
            ...styles.drawerContainer,
            flexDirection: "column",
          }}
        >
          <ConversationsDrawer
            onPress={onHandleGetFile}
            selected={chatName ? chatName : ""}
          />
        </Grid>
      )}
      <Grid
        xs={phone ? 12 : 7}
        md={8}
        style={{
          ...styles.chatContainer,
          /* El alto fijo es solo para el chat abierto, que tiene su propio
             scroll de mensajes dentro. En el inicio (lista de chats, 3a/4d)
             no hay scroll interno: con un tope, una lista larga se salía de
             la columna y se pintaba encima del pie y por debajo de él. */
          height: chat && altoChat ? altoChat : undefined,
          maxHeight: chat ? (altoChat ? altoChat : "100dvh") : "none",
          flexDirection: "column",
        }}
      >
        <div ref={inicioColumna} aria-hidden style={{ height: 0, width: "100%" }} />
        {chat ? (
          <>
            <ManageFileCard isFirstFile={ fileList && fileList.length > 0 ? false : true } chat={true} />
            {/* La clave es el chat abierto, no la hora. Con `new Date().getTime()`
                la cabecera se recreaba en CADA render, y como el buscador del
                chat vive aquí dentro, cada letra tecleada desmontaba el campo:
                perdía el foco tras la primera (en móvil ni esa se quedaba).
                Con el nombre del chat se recrea solo al cambiar de chat. */}
            <Container style={{ marginTop: 15 }} key={chatName || "chat"}>

              {/* Cabecera del chat (1a): inicial en tinta, nombre limpio y el
                  archivo en mono; debajo el buscador a ancho completo y
                  Mensajes/Media como control segmentado. */}
              {!ocultarCabecera && (() => {
                const archivo = chatName !== null ? splitChatName(extractUsername(chatName)).name : "";
                const nombre = nombreDelContacto(archivo || "") || archivo;
                const subidoEn = (fileList || []).find((f: any) => f.fullPath === rutaAbierta)?.creadoEn;
                const inicial = (nombre || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {/* «‹ Resultados» (11b): vuelve a la vista de resultados
                        con la misma búsqueda. Solo si se llegó desde ella. */}
                    {!phone && desdeResultados && (
                      <>
                        <button type="button" className="br-volver-inicio" style={{ fontSize: 13.5, flexShrink: 0 }} onClick={volverAResultados}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                          {t("Resultados")}
                        </button>
                        <span aria-hidden style={{ width: 1, height: 24, background: "var(--border)", flexShrink: 0 }} />
                      </>
                    )}
                    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, background: "var(--ink-900)", color: "var(--paper-50)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 17 }}>
                      {inicial}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 21, letterSpacing: "-0.01em", color: "var(--ink-900)", lineHeight: 1.1 }}>
                        {nombre}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: subidoEn ? "uppercase" : undefined }}>
                        {/* Fecha y hora de subida en vez del .zip (las
                            versiones del mismo chat se llaman igual). */}
                        {subidoEn
                          ? t("Subido {{fecha}}", { fecha: fechaDeSubida(subidoEn, i18n.language || "es") })
                          : archivo}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Buscador del chat abierto, a ancho completo (1a/1c). No
                  filtra: resalta y deja saltar entre coincidencias. */}
              <Box marginTop={ocultarCabecera ? 0 : 1.5}>
                {filtro ? (
                  /* Mientras se mira de dónde sale una cifra, la barra ocupa
                     el sitio del buscador en vez de añadirse debajo: son la
                     misma pregunta («qué estoy viendo marcado»), y dos filas
                     a la vez dejarían dos contadores distintos en pantalla. */
                  <FiltroDelAnalisis
                    etiqueta={filtro.etiqueta}
                    total={coincidencias.total}
                    activa={activa}
                    onActiva={setActiva}
                    onQuitar={() => setFiltro(null)}
                    onTodos={
                      filtro.autor
                        ? () => {
                            /* La etiqueta pierde el nombre con los
                               resultados: «Gracias · Yasmín» encima de los
                               ocho del grupo sería mentira. */
                            setFiltro({
                              etiqueta: filtro.etiqueta.split(" · ")[0],
                              terminos: filtro.terminos,
                            });
                            setActiva(0);
                          }
                        : undefined
                    }
                  />
                ) : (
                  <BuscadorEnChat
                    onAbierto={setBuscando}
                    consulta={chatSearch}
                    onConsulta={setChatSearch}
                    total={coincidencias.total}
                    activa={activa}
                    onActiva={setActiva}
                  />
                )}
              </Box>

              {/* Mensajes y Media son dos vistas de lo mismo, no dos acciones. */}
              <Box marginTop={1.5} marginBottom={1.5} style={{ display: ocultarCabecera ? "none" : undefined }}>
                <ControlSegmentado
                  completo
                  valor={toShow}
                  onCambio={(v) => {
                    /* En escritorio «Análisis» no es una vista: abre y
                       cierra el panel de al lado y deja el chat donde
                       está. En el móvil no cabe esa columna, así que ahí
                       sí sustituye a la pantalla. */
                    if (v === "analisis" && !phone) {
                      setPanelLateral((abierto) => !abierto);
                      return;
                    }
                    setToShow(v as "photos" | "message" | "analisis");
                  }}
                  opciones={[
                    { valor: "message", etiqueta: enTexto(t("Mensajes")) },
                    { valor: "photos", etiqueta: enTexto(t("Media")) },
                    /* La misma barra en los dos tamaños. Lo que cambia es
                       qué hace al pulsarla, no dónde está. */
                    ...(ANALISIS_ACTIVO
                      ? [
                          {
                            valor: "analisis",
                            etiqueta: enTexto(t("Análisis")),
                            insignia: enTexto(t("Nuevo")),
                            conmutador: !phone,
                            encendido: panelLateral,
                          },
                        ]
                      : []),
                  ]}
                />
                {/* Los tiempos de respuesta, encima del chat y no escondidos
                    en Ajustes: es una forma de leer el chat, no una
                    preferencia que se configura una vez. */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ANALISIS_ACTIVO && toShow === "message" && (
                    <button
                      type="button"
                      className={
                        mostrarEsperas
                          ? "br-an-conmutador br-an-conmutador--activo"
                          : "br-an-conmutador"
                      }
                      aria-pressed={mostrarEsperas}
                      onClick={() => setMostrarEsperas((v) => !v)}
                    >
                      {t("Tiempos de respuesta")}
                    </button>
                  )}
                </div>
              </Box>

            </Container>
            <Grid
              xs={12}
              className={panelLateral ? "br-an-partido" : undefined}
              style={{
                flexDirection: "column",
                /* Con el panel al lado, el scroll pasa a cada columna: si lo
                   mantuviera aquí, bajar en el análisis arrastraría el chat
                   y las dos cosas se perderían a la vez. */
                overflowY: panelLateral ? "hidden" : "scroll",
                overflowX: "hidden",
                width: "100%",
                minWidth: 0,
                marginTop: 12,
                padding: panelLateral ? 0 : "4px 16px 24px",
                background: "var(--paper-100)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className={panelLateral ? "br-an-columna" : undefined}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "60px 0",
                    gap: 16,
                    width: "100%",
                  }}
                >
                  <Loading size="lg" />
                  <span style={{ color: "var(--slate-700)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                    {t("Obteniendo mensajes del backup...")}
                  </span>
                </div>
              ) : toShow === "analisis" ? (
                elAnalisis
              ) : toShow === "photos" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, padding: "4px 0", width: "100%" }}>
                    {visibleMessages.slice(0, visibleCount).map((item: any, i: number) => (
                      <ChatView
                        key={i}
                        toShow={toShow}
                        date={item[0]}
                        message={item[2]}
                        messenger={item[1]}
                        chatSearch={consultaDe(item?.[1])}
                        gallery
                      />
                    ))}
                  </div>
                  {visibleCount < visibleMessages.length && (
                    <>
                      <div ref={sentinelRef} style={{ height: 1, width: "100%" }} />
                      <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 32px" }}>
                        <button className="br-btn br-btn-ghost br-btn-md" onClick={() => setVisibleCount((c) => c + CHUNK)}>
                          {t("Cargar más")}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {visibleMessages.slice(0, visibleCount).map(
                    (item: any, i: number) => {
                      /* Separador de dia.
                         Sale cuando la fecha cambia respecto al mensaje
                         anterior, que es exactamente cuando aporta algo. El
                         primer mensaje siempre lo lleva: sin el, el chat
                         empieza sin decir de cuando es. */
                      const dia = claveDeDia(item[0]);
                      const diaAnterior =
                        i > 0 ? claveDeDia(visibleMessages[i - 1][0]) : null;
                      const cambiaDeDia = !!dia && dia !== diaAnterior;

                      /* Cuánto se tardó en contestar, cuando se nota.
                         El dato está delante de los ojos desde siempre (dos
                         horas en los relojes de dos mensajes seguidos), pero
                         nadie lo resta mientras lee. Dicho, cambia cómo se
                         lee la conversación. Por debajo de media hora no se
                         enseña: sería una etiqueta en cada mensaje y dejaría
                         de verse el chat. */
                      const espera =
                        mostrarEsperas && i > 0 && !cambiaDeDia
                          ? esperaEntre(visibleMessages[i - 1], item)
                          : null;

                      return (
                        <Fragment key={i}>
                          {/* Ancla sin alto: sirve para saltar aquí desde el
                              análisis sin tocar cómo se pinta la burbuja. */}
                          <div data-mensaje={i} style={{ height: 0 }} />
                          {cambiaDeDia && (
                            <div
                              role="separator"
                              style={{
                                alignSelf: "center",
                                textAlign: "center",
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--slate-500)",
                                padding: "18px 0 4px",
                              }}
                            >
                              {etiquetaDeDia(dia, {
                                idioma: i18n.language,
                                hoy: (t("Hoy") as string) || "Hoy",
                                ayer: (t("Ayer") as string) || "Ayer",
                                corta: true,
                              })}
                            </div>
                          )}
                          {espera !== null && (
                            <div role="separator" className="br-an-espera">
                              {t("respuesta en {{tiempo}}", {
                                tiempo: enTexto(
                                  t(ETIQUETA_ESPERA[duracion(espera).unidad], {
                                    valor: numeroCorto(duracion(espera).valor),
                                  })
                                ),
                              })}
                            </div>
                          )}
                          <ChatView
                            toShow={toShow}
                            date={item[0]}
                            message={item[2]}
                            messenger={item[1]}
                            chatSearch={consultaDe(item?.[1])}
                            coincidenciaActiva={activa}
                            desplazamiento={coincidencias.desplazamientos[i] ?? 0}
                            /* Con el filtro puesto, lo que no coincide se
                               apaga: así se ve de un vistazo cuáles son los
                               35 sin perder la conversación de alrededor. */
                            atenuado={!!filtro && (coincidencias.porMensaje[i] ?? 0) === 0}
                            isMine={!!myName && (item[1] || "").trim() === myName}
                            /* El nombre solo en el primero de una racha del
                               mismo remitente el mismo día (1a). */
                            mostrarRemitente={
                              cambiaDeDia ||
                              (visibleMessages[i - 1]?.[1] || "").trim() !== (item[1] || "").trim()
                            }
                          />
                        </Fragment>
                      );
                    }
                  )}
                  {visibleCount < visibleMessages.length && (
                    <>
                      <div ref={sentinelRef} style={{ height: 1, width: "100%" }} />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          padding: "16px 0 32px",
                        }}
                      >
                        <Button
                          variant="outlined"
                          style={{ textTransform: "none", borderRadius: 10 }}
                          onClick={() =>
                            setVisibleCount((c) => c + CHUNK)
                          }
                        >
                          <Typography
                            fontFamily={"var(--font-sans)"}
                            fontSize={12}
                            style={{ color: "var(--slate-700)" }}
                          >
                            {t("Cargar más mensajes")}
                          </Typography>
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
              </div>
              {/* El análisis, a la derecha y con su propio scroll. Mismo
                  componente que la pestaña del móvil. */}
              {panelLateral && (
                <aside className="br-an-columna br-an-columna--panel">{elAnalisis}</aside>
              )}
            </Grid>
          </>
        ) :
          <ManageFileCard isFirstFile={ fileList && fileList.length > 0 ? false : true } chat={false} />
        }
      </Grid>
    </Grid.Container>
  );
};
