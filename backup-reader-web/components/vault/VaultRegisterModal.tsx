import React, { useContext, useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input, Loading } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";
import { RecoveryCodeModal } from "./RecoveryCodeModal";

/** Mínimos de contraseña. Deliberadamente modestos: lo que protege es Argon2id. */
const MIN_LARGO = 10;

export const VaultRegisterModal: React.FC = () => {
  const { t } = useTranslation();
  const { show, hide } = useContext(ModalContext);
  const { registerVault } = useVault();

  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const onCrear = async () => {
    if (password.length < MIN_LARGO) {
      setAviso(t(`La contraseña debe tener al menos ${MIN_LARGO} caracteres.`));
      return;
    }
    if (password !== repetida) {
      setAviso(t("Las dos contraseñas no coinciden."));
      return;
    }

    setAviso("");
    setOcupado(true);
    const codigo = await registerVault(password);
    setOcupado(false);

    if (!codigo) {
      setAviso(t("No se pudo crear la protección. Inténtalo de nuevo."));
      return;
    }
    // El código se muestra UNA sola vez, en su propio modal.
    show({ modalContent: <RecoveryCodeModal codigo={codigo} />, withScroll: true });
  };

  return (
    <>
      <Modal.Header>
        <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
          {t("Protege tus chats")}
        </Typography>
      </Modal.Header>

      <Modal.Body>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={15}
          style={{ color: "#3C3C3C", marginBottom: 8 }}
        >
          {t(
            "Elige una contraseña de cifrado. Con ella, tus chats se cifran en tu navegador antes de subirse: nadie más puede leerlos, ni siquiera nosotros."
          )}
        </Typography>

        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#B23B3B", marginBottom: 12 }}
        >
          {t(
            "Importante: esta contraseña no se puede recuperar. Si la pierdes junto con el código de recuperación, tus chats quedan inaccesibles para siempre."
          )}
        </Typography>

        <Input.Password
          fullWidth
          aria-label={t("Contraseña de cifrado")}
          placeholder={t("Contraseña de cifrado")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input.Password
          fullWidth
          aria-label={t("Repite la contraseña")}
          placeholder={t("Repite la contraseña")}
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />

        {aviso && (
          <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#B23B3B" }}>
            {aviso}
          </Typography>
        )}
      </Modal.Body>

      <Modal.Footer justify="center">
        <Button auto light onPress={hide} disabled={ocupado}>
          {t("Ahora no")}
        </Button>
        <Button auto onPress={onCrear} disabled={ocupado}>
          {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Crear")}
        </Button>
      </Modal.Footer>
    </>
  );
};
