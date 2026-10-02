import React, { useContext, useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input, Loading } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";

export const VaultUnlockModal: React.FC = () => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const { unlock, unlockWithCode, clearError } = useVault();

  const [modo, setModo] = useState<"password" | "codigo">("password");
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const onDesbloquear = async () => {
    if (!valor) return;
    setAviso("");
    setOcupado(true);
    // Argon2id tarda ~1 s a propósito: es lo que hace cara la fuerza bruta.
    const ok =
      modo === "password" ? await unlock(valor) : await unlockWithCode(valor);
    setOcupado(false);

    if (ok) {
      setValor("");
      hide();
      return;
    }
    setAviso(
      modo === "password"
        ? t("La contraseña no es correcta.")
        : t("El código de recuperación no es correcto.")
    );
  };

  const cambiarModo = () => {
    setModo(modo === "password" ? "codigo" : "password");
    setValor("");
    setAviso("");
    clearError();
  };

  return (
    <>
      <Modal.Header>
        <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
          {t("Desbloquea tus chats")}
        </Typography>
      </Modal.Header>

      <Modal.Body>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={15}
          style={{ color: "#3C3C3C", marginBottom: 8 }}
        >
          {modo === "password"
            ? t("Introduce tu contraseña de cifrado para ver tus chats.")
            : t("Introduce tu código de recuperación.")}
        </Typography>

        {modo === "password" ? (
          <Input.Password
            fullWidth
            autoFocus
            aria-label={t("Contraseña de cifrado")}
            placeholder={t("Contraseña de cifrado")}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onDesbloquear()}
          />
        ) : (
          <Input
            fullWidth
            autoFocus
            aria-label={t("Código de recuperación")}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onDesbloquear()}
          />
        )}

        {aviso && (
          <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#B23B3B" }}>
            {aviso}
          </Typography>
        )}

        <Button auto light size="sm" onPress={cambiarModo} disabled={ocupado}>
          {modo === "password"
            ? t("He olvidado la contraseña")
            : t("Usar la contraseña")}
        </Button>
      </Modal.Body>

      <Modal.Footer justify="center">
        <Button auto onPress={onDesbloquear} disabled={ocupado || !valor}>
          {ocupado ? (
            <Loading type="points" color="currentColor" size="sm" />
          ) : (
            t("Desbloquear")
          )}
        </Button>
      </Modal.Footer>
    </>
  );
};
