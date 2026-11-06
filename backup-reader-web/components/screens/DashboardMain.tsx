import { FC } from "react";
import { DashboardScreen } from ".";
import { VaultBanner } from "../vault";

export const DashboardMain: FC = () => {
  return (
    <>
      {/* Aviso del estado de la bóveda. Va aquí y no dentro de
          DashboardScreen para que se vea también sin chats subidos.

          Las medidas son las mismas que usan la cabecera (`br-header-inner`) y
          el contenido (`Grid.Container` de DashboardScreen): 1360 de ancho,
          centrado, y el mismo padding lateral. Antes este div no tenía límite,
          así que en pantallas anchas el aviso se estiraba de borde a borde
          mientras todo lo demás quedaba centrado y más estrecho. */}
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