import React, { useContext, useState } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button, Input, Loading } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";
import { RecoveryCodeModal } from "./RecoveryCodeModal";
import { VaultRegisterModal } from "./VaultRegisterModal";

const MIN_LARGO = 10;

/**
 * Bloque de cifrado para AccountScreen.
 *
 * Cambiar la contraseña NO re-cifra los chats: solo vuelve a envolver la DEK,
 * que son unos pocos bytes. Por eso es instantáneo aunque haya gigabytes
 * guardados.
 */
export const VaultPasswordSection: React.FC = () => {
  const { t } = useTranslation();
  const { show } = useContext(ModalContext);
  const { status, changeVaultPassword, regenerateRecovery, lock } = useVault();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aviso, setAviso] = useState("");
  const [exito, setExito] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (status === "checking") return null;

  if (status === "none") {
    return (
      <Box sx={{ marginTop: 3 }}>
        <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
          {t("Cifrado")}
        </Typography>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={15}
          style={{ color: "#3C3C3C", margin: "8px 0" }}
        >
          {t("Todavía no has activado el cifrado de tus chats.")}
        </Typography>
        <Button auto onPress={() => show({ modalContent: <VaultRegisterModal /> })}>
          {t("Activar cifrado")}
        </Button>
      </Box>
    );
  }

  const onCambiar = async () => {
    setAviso("");
    setExito("");
    if (nueva.length < MIN_LARGO) {
      setAviso(t(`La nueva contraseña debe tener al menos ${MIN_LARGO} caracteres.`));
      return;
    }
    if (nueva !== repetida) {
      setAviso(t("Las dos contraseñas no coinciden."));
      return;
    }
    setOcupado(true);
    const ok = await changeVaultPassword(actual, nueva);
    setOcupado(false);
    if (!ok) {
      setAviso(t("La contraseña actual no es correcta."));
      return;
    }
    setActual("");
    setNueva("");
    setRepetida("");
    setExito(t("Contraseña actualizada."));
  };

  const onRegenerar = async () => {
    setAviso("");
    setExito("");
    setOcupado(true);
    const codigo = await regenerateRecovery();
    setOcupado(false);
    if (!codigo) {
      setAviso(t("No se pudo generar un código nuevo. Desbloquea la bóveda e inténtalo otra vez."));
      return;
    }
    show({ modalContent: <RecoveryCodeModal codigo={codigo} />, withScroll: true });
  };

  const bloqueada = status === "locked";

  return (
    <Box sx={{ marginTop: 3 }}>
      <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
        {t("Cifrado")}
      </Typography>

      <Typography
        fontFamily={"Open Sans"}
        fontSize={14}
        style={{ color: "#6B6B6B", margin: "4px 0 12px" }}
      >
        {bloqueada
          ? t("La bóveda está bloqueada en esta sesión.")
          : t("La bóveda está desbloqueada en esta sesión.")}
      </Typography>

      <Typography fontFamily={"Open Sans"} fontSize={15} style={{ color: "#3C3C3C" }}>
        {t("Cambiar la contraseña de cifrado")}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxWidth: 380, marginTop: 1 }}>
        <Input.Password
          aria-label={t("Contraseña actual")}
          placeholder={t("Contraseña actual")}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <Input.Password
          aria-label={t("Nueva contraseña")}
          placeholder={t("Nueva contraseña")}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <Input.Password
          aria-label={t("Repite la nueva contraseña")}
          placeholder={t("Repite la nueva contraseña")}
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />

        {aviso && (
          <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#B23B3B" }}>
            {aviso}
          </Typography>
        )}
        {exito && (
          <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#2E7D32" }}>
            {exito}
          </Typography>
        )}

        <Button auto onPress={onCambiar} disabled={ocupado || !actual || !nueva}>
          {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Cambiar contraseña")}
        </Button>
      </Box>

      <Divider sx={{ margin: "20px 0" }} />

      <Typography fontFamily={"Open Sans"} fontSize={15} style={{ color: "#3C3C3C" }}>
        {t("Código de recuperación")}
      </Typography>
      <Typography
        fontFamily={"Open Sans"}
        fontSize={14}
        style={{ color: "#6B6B6B", margin: "4px 0 8px" }}
      >
        {t("Generar uno nuevo invalida el anterior. Requiere la bóveda desbloqueada.")}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button auto bordered onPress={onRegenerar} disabled={ocupado || bloqueada}>
          {t("Generar código nuevo")}
        </Button>
        {!bloqueada && (
          <Button auto light onPress={lock}>
            {t("Bloquear ahora")}
          </Button>
        )}
      </Box>
    </Box>
  );
};
