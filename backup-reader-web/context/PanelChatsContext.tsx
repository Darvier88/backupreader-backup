import { createContext, useContext, useMemo, useState, FC, ReactNode } from "react";

/**
 * Quién abre y cierra el panel de chats en móvil.
 *
 * El panel lo pinta `Layout` y el botón de la cabecera también, así que hasta
 * ahora el estado vivía ahí y no hacía falta nada más. La pantalla de inicio
 * (2a) añade un segundo sitio desde donde se abre —«Ver mis chats»—, y esa
 * pantalla cuelga de `DashboardScreen`, que no es hijo de nadie que tenga ese
 * estado.
 *
 * Las alternativas eran pasar la función por props a través de tres
 * componentes que no la usan, o disparar un evento del DOM. Lo primero ata
 * componentes intermedios a algo que no les incumbe; lo segundo funciona pero
 * deja la relación invisible: nadie que lea `Layout` sabría que alguien más
 * puede abrir el panel.
 */

/**
 * A qué mensaje hay que saltar al abrir un chat.
 *
 * Lo pone un resultado de la búsqueda global y lo recoge la vista del chat
 * cuando ya ha cargado. Va por aquí y no por la URL porque es un destino
 * efímero: recargar la página con ese estado en la barra de direcciones
 * llevaría a un mensaje que quizá ya no existe, y porque el número de mensaje
 * de un chat cifrado no es algo que deba quedar escrito en el historial del
 * navegador.
 */
export type ObjetivoBusqueda = {
  /** Lo buscado, para que la vista del chat lo resalte al llegar. */
  consulta: string;
  /** Número de mensaje al que saltar. */
  mensaje: number;
};

/**
 * Lo que se está buscando en TODOS los chats, y cuánto hay en cada uno.
 *
 * En escritorio el buscador vive en el centro de la pantalla (8b) y el panel
 * lateral enseña cuántas coincidencias tiene cada chat (8c). Son dos sitios
 * distintos del árbol que necesitan lo mismo, así que lo comparten aquí en
 * vez de pasárselo por props a través de media aplicación.
 */
type PanelChats = {
  /** Lo escrito en el buscador general. */
  consulta: string;
  setConsulta: (valor: string) => void;
  /** backupId -> cuántas coincidencias tiene ese chat. */
  porChat: Record<string, number>;
  setPorChat: (valor: Record<string, number>) => void;
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
  objetivo: ObjetivoBusqueda | null;
  irAMensaje: (objetivo: ObjetivoBusqueda) => void;
  limpiarObjetivo: () => void;
};

const Contexto = createContext<PanelChats>({
  consulta: "",
  setConsulta: () => {},
  porChat: {},
  setPorChat: () => {},
  abierto: false,
  abrir: () => {},
  cerrar: () => {},
  alternar: () => {},
  objetivo: null,
  irAMensaje: () => {},
  limpiarObjetivo: () => {},
});

export const PanelChatsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [abierto, setAbierto] = useState(false);
  const [objetivo, setObjetivo] = useState<ObjetivoBusqueda | null>(null);
  const [consulta, setConsulta] = useState("");
  const [porChat, setPorChat] = useState<Record<string, number>>({});

  const valor = useMemo(
    () => ({
      consulta,
      setConsulta,
      porChat,
      setPorChat,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      alternar: () => setAbierto((a) => !a),
      objetivo,
      irAMensaje: (o: ObjetivoBusqueda) => {
        setObjetivo(o);
        /* Se cierra el panel: el resultado que se acaba de pulsar esta detras
           de el, y dejarlo abierto esconde justo lo que se venia a ver. */
        setAbierto(false);
      },
      limpiarObjetivo: () => setObjetivo(null),
    }),
    [abierto, objetivo, consulta, porChat]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const usePanelChats = () => useContext(Contexto);
