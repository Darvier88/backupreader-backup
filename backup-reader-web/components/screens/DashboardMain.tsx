import { FC } from "react";
import { DashboardScreen } from ".";
import { VaultBanner } from "../vault";

export const DashboardMain: FC = () => {
  return (
    <>
      {/* Aviso del estado de la bóveda. Va aquí y no dentro de
          DashboardScreen para que se vea también sin chats subidos. */}
      <div style={{ padding: "12px 16px 0" }}>
        <VaultBanner />
      </div>
      <DashboardScreen />
    </>
  );
};