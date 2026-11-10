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

type PanelChats = {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
};

const Contexto = createContext<PanelChats>({
  abierto: false,
  abrir: () => {},
  cerrar: () => {},
  alternar: () => {},
});

export const PanelChatsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [abierto, setAbierto] = useState(false);

  const valor = useMemo(
    () => ({
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      alternar: () => setAbierto((a) => !a),
    }),
    [abierto]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const usePanelChats = () => useContext(Contexto);
