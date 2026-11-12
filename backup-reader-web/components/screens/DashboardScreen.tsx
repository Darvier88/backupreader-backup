import { FC, Fragment, useContext, useState, useEffect, useMemo, useRef } from "react";

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
import { BuscadorEnChat } from "../chat/BuscadorEnChat";
import { ControlSegmentado } from "../ui/ControlSegmentado";
import { cuantasVeces } from "../../lib/busqueda/resaltar";
import { claveDeDia, etiquetaDeDia } from "../../lib/fechas-de-chat";
import { nombreDelContacto } from "../../lib/nombres-de-chat";
import { usePanelChats } from "../../context/PanelChatsContext";

/** `t()` puede devolver null segun sus tipos; esto lo deja en string. */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";
import { StorageContext } from "../../context/StorageContext";
import { useLoading } from "../../context/LoadingContext";
import useInView from "../../hooks/useInView";
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
    maxHeight: "85vh",
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

export const DashboardScreen: FC = () => {
  const [chatSearch, setChatSearch] = useState<string>("");
  const { getFile, chat, chatName, uploadStatus, cerrarChat } = useContext(StorageContext);
  const { loading } = useLoading();
  const [toShow, setToShow] = useState<"photos" | "message">("message");
  const [state, setState] = useState<boolean>(true);
  const { fileList } = useContext(StorageContext);
  const { objetivo, limpiarObjetivo } = usePanelChats();

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
          return isImage || isVideo || isAudio;
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

    if (chatSearch.trim().length < 2) {
      return { porMensaje, desplazamientos, total: 0 };
    }

    for (const item of visibleMessages) {
      const n = cuantasVeces((item as any)[2] || "", chatSearch);
      desplazamientos.push(acumulado);
      porMensaje.push(n);
      acumulado += n;
    }

    return { porMensaje, desplazamientos, total: acumulado };
  }, [visibleMessages, chatSearch]);

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
  }, [chat, toShow, chatSearch]);

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
    getFile(fullPath, name);
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
        cerrarChat();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [chat]);

  /* En el móvil, al enfocar la búsqueda toma la cabecera (1c). */
  const [buscando, setBuscando] = useState(false);
  const ocultarCabecera = phone && buscando;

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
          flexDirection: "column",
        }}
      >
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
                const inicial = (nombre || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, background: "var(--ink-900)", color: "var(--paper-50)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 17 }}>
                      {inicial}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 21, letterSpacing: "-0.01em", color: "var(--ink-900)", lineHeight: 1.1 }}>
                        {nombre}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {archivo}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Buscador del chat abierto, a ancho completo (1a/1c). No
                  filtra: resalta y deja saltar entre coincidencias. */}
              <Box marginTop={ocultarCabecera ? 0 : 1.5}>
                <BuscadorEnChat
                  onAbierto={setBuscando}
                  consulta={chatSearch}
                  onConsulta={setChatSearch}
                  total={coincidencias.total}
                  activa={activa}
                  onActiva={setActiva}
                />
              </Box>

              {/* Mensajes y Media son dos vistas de lo mismo, no dos acciones. */}
              <Box marginTop={1.5} marginBottom={1.5} style={{ display: ocultarCabecera ? "none" : undefined }}>
                <ControlSegmentado
                  completo
                  valor={toShow}
                  onCambio={(v) => setToShow(v as "photos" | "message")}
                  opciones={[
                    { valor: "message", etiqueta: enTexto(t("Mensajes")) },
                    { valor: "photos", etiqueta: enTexto(t("Media")) },
                  ]}
                />
              </Box>

            </Container>
            <Grid
              xs={12}
              style={{
                flexDirection: "column",
                overflowY: "scroll",
                overflowX: "hidden",
                width: "100%",
                minWidth: 0,
                marginTop: 12,
                padding: "4px 16px 24px",
                background: "var(--paper-100)",
                borderTop: "1px solid var(--border)",
              }}
            >
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
                        chatSearch={chatSearch}
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

                      return (
                        <Fragment key={i}>
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
                          <ChatView
                            toShow={toShow}
                            date={item[0]}
                            message={item[2]}
                            messenger={item[1]}
                            chatSearch={chatSearch}
                            coincidenciaActiva={activa}
                            desplazamiento={coincidencias.desplazamientos[i] ?? 0}
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
            </Grid>
          </>
        ) :
          <ManageFileCard isFirstFile={ fileList && fileList.length > 0 ? false : true } chat={false} />
        }
      </Grid>
    </Grid.Container>
  );
};
