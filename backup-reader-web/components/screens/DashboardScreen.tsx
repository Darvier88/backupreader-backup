import { FC, useContext, useState, useEffect, useMemo, useRef } from "react";

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
import { DividerLine } from "../ui/DividerLine";
import { ConversationsDrawer } from "../drawers";
import { SearchInput } from "../inputs/SearchInput";
import { StorageContext } from "../../context/StorageContext";
import { useLoading } from "../../context/LoadingContext";
import useInView from "../../hooks/useInView";
import { t } from "i18next";



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
    height: "100%",
    display: "flex",
    backgroundColor: "var(--paper-100)",
    borderRight: "1px solid var(--border)",
  },
};

export const DashboardScreen: FC = () => {
  const [chatSearch, setChatSearch] = useState<string>("");
  const { getFile, chat, chatName, uploadStatus } = useContext(StorageContext);
  const { loading } = useLoading();
  const [toShow, setToShow] = useState<"photos" | "message">("message");
  const [state, setState] = useState<boolean>(true);
  const { fileList } = useContext(StorageContext);

  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );

  // ---- Render incremental de mensajes ----
  // Renderizar TODOS los mensajes de golpe congela la pestaña en chats pesados.
  // En su lugar mostramos bloques y vamos cargando más al hacer scroll.
  const CHUNK = 60;
  const [visibleCount, setVisibleCount] = useState<number>(CHUNK);

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
            <Container style={{ marginTop: 15 }}  key={new Date().getTime()}>

              <Box
                display={"flex"}
                flexDirection={phone ? "column" : "row"}
                alignItems={phone ? "flex-start" : "center"}
                justifyContent={"space-between"}
                marginBottom={phone ? 2 : 0}
              >
                <div style={{ minWidth: 0 }}>
                  <Typography
                    fontFamily={"var(--font-serif)"}
                    fontSize={26}
                    style={{ color: "var(--ink-900)", fontWeight: 500, letterSpacing: "-0.015em" }}
                  >
                    {chatName !== null && splitChatName(extractUsername(chatName)).name}
                  </Typography>
                  {chatName !== null && splitChatName(chatName).date && (
                    <Typography
                      fontFamily={"var(--font-mono)"}
                      fontSize={11}
                      marginTop={0.5}
                      marginBottom={1.5}
                      style={{ color: "var(--slate-500)", letterSpacing: "0.08em", textTransform: "uppercase" }}
                    >
                      {t("Guardado")} {splitChatName(chatName).date}
                    </Typography>
                  )}
                </div>
                <Box
                  display={"flex"}
                  flexDirection={"row"}
                  alignItems={"center"}
                  justifyContent={"space-between"}
                  width={phone ? "100%" : "45%"}
                >
                  <SearchInput
                    width={phone ? 100 : 150}
                    placeHolder="Buscar"
                    onSearch={onHandleSearch}
                  />
                  <Button
                    variant="outlined"
                    style={{
                      textTransform: "none",
                      height: 40,
                      marginLeft: 10,
                      marginRight: 10,
                      borderRadius: 8,
                      borderColor: toShow === "message" ? "var(--ink-900)" : "var(--border)",
                      width: phone ? 70 : 100,
                      backgroundColor:
                        toShow === "message" ? "var(--ink-900)" : "var(--surface-raised)",
                    }}
                    onClick={() => setToShow("message")}
                  >
                    <Typography
                      fontFamily={"var(--font-sans)"}
                      fontSize={13}
                      style={{
                        color: toShow === "message" ? "var(--paper-50)" : "var(--slate-700)",
                        fontWeight: 600,
                      }}
                    >
                      Mensajes
                    </Typography>
                  </Button>

                  <Button
                    variant="outlined"
                    style={{
                      textTransform: "none",
                      height: 40,
                      borderRadius: 8,
                      borderColor: toShow === "photos" ? "var(--ink-900)" : "var(--border)",
                      width: phone ? 70 : 100,
                      backgroundColor:
                        toShow === "photos" ? "var(--ink-900)" : "var(--surface-raised)",
                    }}
                    onClick={() => setToShow("photos")}
                  >
                    <Typography
                      fontFamily={"var(--font-sans)"}
                      fontSize={13}
                      style={{
                        color: toShow === "photos" ? "var(--paper-50)" : "var(--slate-700)",
                        fontWeight: 600,
                      }}
                    >
                      Media
                    </Typography>
                  </Button>
                </Box>
              </Box>
              <DividerLine width={"100%"} />
            </Container>
            <Grid
              xs={12}
              style={{
                flexDirection: "column",
                overflowY: "scroll",
                overflowX: "hidden",
                width: "100%",
                minWidth: 0,
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
                  <span style={{ color: "#3C3C3C", fontFamily: "Open Sans", fontSize: 13 }}>
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
                    (item: any, i: number) => (
                      <ChatView
                        key={i}
                        toShow={toShow}
                        date={item[0]}
                        message={item[2]}
                        messenger={item[1]}
                        chatSearch={chatSearch}
                        isMine={!!myName && (item[1] || "").trim() === myName}
                      />
                    )
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
                            fontFamily={"Open Sans"}
                            fontSize={12}
                            style={{ color: "#3C3C3C" }}
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
