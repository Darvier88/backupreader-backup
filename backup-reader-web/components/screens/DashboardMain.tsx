import { FC } from "react";
import { DashboardScreen } from ".";
import { VaultBanner } from "../vault";

export const DashboardMain: FC = () => {
  return (
    <>
      {/* Aviso del estado de la bóveda. Va aquí y no dentro de
          DashboardScreen para que se vea también sin chats subidos.

          Las medidas son exactamente las del `Grid.Container` de
          DashboardScreen: 1360 de ancho, centrado, y SIN padding lateral.

          Lo de no llevar padding es a propósito y está medido. La cabecera sí
          lo lleva, así que copiárselo dejaba el aviso 24 px a la derecha del
          panel de chats. Lo que tiene que cuadrar es con el contenido, que es
          lo que queda justo debajo.

          Antes este div no tenía límite de ancho, así que en pantallas anchas
          el aviso se estiraba de borde a borde mientras todo lo demás quedaba
          centrado y más estrecho. */}
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          width: "100%",
          padding: "12px 0 0",
        }}
      >
        <VaultBanner />
      </div>
      <DashboardScreen />
    </>
  );
};