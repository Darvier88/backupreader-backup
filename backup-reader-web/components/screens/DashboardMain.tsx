import { FC } from "react";
import { DashboardScreen } from ".";
import { VaultBanner } from "../vault";

export const DashboardMain: FC = () => {
  return (
    <>
      {/* Aviso del estado de la bóveda. Va aquí y no dentro de
          DashboardScreen para que se vea también sin chats subidos.

          Las medidas son las de `br-header-inner`: 1360 de ancho, centrado, y
          el mismo padding lateral. Así el aviso empieza justo donde empieza el
          logo y termina donde terminan las opciones de la cabecera.

          Ojo a una inconsistencia que ya existía y que esto NO arregla: el
          `Grid.Container` de DashboardScreen va con `gap={0}`, que en NextUI
          se traduce en padding 0, así que el panel de chats empieza entre 16 y
          24 px más a la izquierda que el logo. El aviso cuadra con la
          cabecera, no con el panel. Unificar los tres significa darle ese
          mismo padding al contenedor del contenido, lo que mueve el panel de
          chats y la zona de mensajes.

          Antes este div no tenía límite de ancho, así que en pantallas anchas
          el aviso se estiraba de borde a borde mientras todo lo demás quedaba
          centrado y más estrecho. */}
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          width: "100%",
          padding: "12px clamp(16px, 4vw, 24px) 0",
        }}
      >
        <VaultBanner />
      </div>
      <DashboardScreen />
    </>
  );
};