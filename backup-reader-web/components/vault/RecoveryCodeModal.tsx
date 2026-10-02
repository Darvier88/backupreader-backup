import React, { useContext, useState } from "react";
import { Typography, Checkbox, FormControlLabel } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";

type Props = { codigo: string };

/**
 * Muestra el código de recuperación UNA sola vez.
 *
 * No se guarda en ningún sitio: el servidor solo tiene la DEK envuelta con él,
 * no el código. Si el usuario lo pierde y además olvida la contraseña, no hay
 * forma de recuperar los datos. De ahí la confirmación explícita: no basta con
 * cerrar el modal, hay que marcar la casilla.
 */
export const RecoveryCodeModal: React.FC<Props> = ({ codigo }) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const { acknowledgeRecoveryCode } = useVault();
  const [confirmado, setConfirmado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const onCopiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const onDescargar = () => {
    const blob = new Blob(
      [
        `Backup Reader — código de recuperación\n\n${codigo}\n\n` +
          `Guarda este archivo en un lugar seguro. Es la única forma de recuperar ` +
          `el acceso a tus chats si olvidas la contraseña de cifrado.\n`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-reader-codigo-recuperacion.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onTerminar = () => {
    acknowledgeRecoveryCode();
    hide();
  };

  return (
    <>
      <Modal.Header>
        <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
          {t("Guarda tu código de recuperación")}
        </Typography>
      </Modal.Header>

      <Modal.Body>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={15}
          style={{ color: "#3C3C3C", marginBottom: 8 }}
        >
          {t(
            "Este código es la única forma de recuperar tus chats si olvidas la contraseña. No volverá a mostrarse."
          )}
        </Typography>

        <Typography
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            letterSpacing: 2,
            textAlign: "center",
            padding: "16px 8px",
            margin: "8px 0",
            background: "#F4F6FA",
            borderRadius: 8,
            color: "#0F52BA",
            wordBreak: "break-all",
          }}
        >
          {codigo}
        </Typography>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button auto bordered size="sm" onPress={onCopiar}>
            {copiado ? t("Copiado") : t("Copiar")}
          </Button>
          <Button auto bordered size="sm" onPress={onDescargar}>
            {t("Descargar")}
          </Button>
        </div>

        <FormControlLabel
          sx={{ marginTop: 1 }}
          control={
            <Checkbox
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
          }
          label={
            <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#3C3C3C" }}>
              {t("He guardado el código en un lugar seguro")}
            </Typography>
          }
        />
      </Modal.Body>

      <Modal.Footer justify="center">
        <Button auto onPress={onTerminar} disabled={!confirmado}>
          {t("Continuar")}
        </Button>
      </Modal.Footer>
    </>
  );
};
