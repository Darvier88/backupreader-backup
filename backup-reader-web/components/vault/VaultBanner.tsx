import React, { useContext } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";
import { VaultRegisterModal } from "./VaultRegisterModal";
import { VaultUnlockModal } from "./VaultUnlockModal";

/**
 * Aviso de estado de la bóveda para el dashboard.
 *
 * NO bloquea: mientras dure la convivencia v1/v2 (Etapa 8), los backups en
 * texto plano se siguen leyendo sin bóveda, así que obligar a desbloquear al
 * entrar dejaría fuera a quien solo quiere leer un chat viejo. Cuando ya no
 * queden backups v1, esto se puede convertir en una pantalla obligatoria.
 */
export const VaultBanner: React.FC = () => {
  const { t } = useTranslation();
  const { show } = useContext(ModalContext);
  const { status } = useVault();

  if (status === "checking" || status === "unlocked") return null;

  const esNueva = status === "none";

  const contenido = esNueva
    ? {
        texto: t(
          "Aún no has activado el cifrado. Actívalo para que tus próximos chats se cifren en tu navegador antes de subirse."
        ),
        boton: t("Activar cifrado"),
        modal: <VaultRegisterModal />,
        fondo: "#F4F6FA",
        borde: "#0F52BA",
      }
    : {
        texto: t("Tus chats cifrados están bloqueados. Introduce tu contraseña para verlos."),
        boton: t("Desbloquear"),
        modal: <VaultUnlockModal />,
        fondo: "#FFF6E5",
        borde: "#D98B00",
      };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        padding: "12px 16px",
        marginBottom: 2,
        borderRadius: 2,
        background: contenido.fondo,
        borderLeft: `4px solid ${contenido.borde}`,
      }}
    >
      <Typography fontFamily={"Open Sans"} fontSize={15} style={{ color: "#3C3C3C" }}>
        {contenido.texto}
      </Typography>
      <Button auto size="sm" onPress={() => show({ modalContent: contenido.modal })}>
        {contenido.boton}
      </Button>
    </Box>
  );
};
