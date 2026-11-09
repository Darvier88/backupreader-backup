import React, { useContext, useEffect, useRef } from "react";
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
 * Sigue sin BLOQUEAR el dashboard: los backups en texto plano se leen sin
 * bóveda, así que obligar a desbloquear al entrar dejaría fuera a quien solo
 * quiere releer un chat viejo.
 *
 * Pero sí se abre solo, una vez por sesión. El motivo es concreto: un usuario
 * de pago se pasó días sin poder subir nada porque pulsó el aviso, cerró el
 * diálogo, y se quedó con la idea de que ya había activado el cifrado. Como
 * `saveFile` corta en seco sin bóveda y ese error no se mostraba, la app
 * simplemente dejaba de responder al botón de subir.
 *
 * Una vez por sesión y con "Ahora no" bien visible: insistente lo justo para
 * que nadie se lo pierda, sin convertirse en un muro.
 */
export const VaultBanner: React.FC = () => {
  const { t } = useTranslation();
  const { show } = useContext(ModalContext);
  const { status } = useVault();
  const yaAbierto = useRef(false);

  const esNueva = status === "none";
  const necesitaAtencion = status === "none" || status === "locked";

  /* En sessionStorage y no en estado: así sobrevive a navegar entre páginas
     dentro de la misma visita, pero no se guarda para siempre. Va dentro de un
     efecto porque en el servidor no existe sessionStorage y leerlo durante el
     render rompería la hidratación. */
  useEffect(() => {
    if (!necesitaAtencion || yaAbierto.current) return;

    const clave = `br-aviso-boveda-${status}`;
    let yaVisto = false;
    try {
      yaVisto = sessionStorage.getItem(clave) === "1";
    } catch {
      /* Navegación privada o almacenamiento bloqueado: se abre igual. */
    }
    if (yaVisto) return;

    yaAbierto.current = true;
    try {
      sessionStorage.setItem(clave, "1");
    } catch {
      /* best-effort */
    }

    show({
      modalContent: esNueva ? <VaultRegisterModal /> : <VaultUnlockModal />,
      width: "min(620px, 94vw)",
      withScroll: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "checking" || status === "unlocked") return null;

  const contenido = esNueva
    ? {
        titulo: t("Activa el cifrado para poder subir chats"),
        texto: t(
          "Hasta que elijas tu contraseña de cifrado no se pueden subir chats nuevos: se cifran en tu navegador antes de salir, y sin esa contraseña no hay con qué cifrarlos."
        ),
        boton: t("Activar cifrado"),
        modal: <VaultRegisterModal />,
        fondo: "#F4F6FA",
        borde: "#0F52BA",
      }
    : {
        titulo: t("Desbloquea tus chats"),
        texto: t(
          "Tus chats cifrados están bloqueados y tampoco puedes subir nuevos. Introduce tu contraseña de cifrado para seguir."
        ),
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
        padding: "16px 20px",
        marginBottom: 2,
        borderRadius: 2,
        background: contenido.fondo,
        borderLeft: `5px solid ${contenido.borde}`,
      }}
    >
      <Box sx={{ minWidth: 0, flex: "1 1 260px" }}>
        <Typography
          fontFamily={"PT Serif"}
          fontSize={17}
          style={{ color: "#1F2933", marginBottom: 4 }}
        >
          {contenido.titulo}
        </Typography>
        <Typography fontFamily={"Open Sans"} fontSize={14.5} style={{ color: "#3B4652" }}>
          {contenido.texto}
        </Typography>
      </Box>
      <Button
        auto
        onPress={() =>
          show({ modalContent: contenido.modal, width: "min(620px, 94vw)", withScroll: true })
        }
      >
        {contenido.boton}
      </Button>
    </Box>
  );
};
