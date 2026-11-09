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
  const { status, changeVaultPassword, resetVaultPassword, regenerateRecovery, lock } =
    useVault();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aviso, setAviso] = useState("");
  const [exito, setExito] = useState("");
  const [ocupado, setOcupado] = useState(false);

  /* Restablecer con el código de recuperación, para quien olvidó la
     contraseña. Va plegado porque es el camino excepcional. */
  const [restableciendo, setRestableciendo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nuevaR, setNuevaR] = useState("");
  const [repetidaR, setRepetidaR] = useState("");
  const [avisoR, setAvisoR] = useState("");

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
      /* Antes la clave se construía con una plantilla, así que i18n recibía un
         texto distinto del que hay en i18n.js y nunca se traducía. */
      setAviso(t("La nueva contraseña debe tener al menos 10 caracteres."));
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

  const onRestablecer = async () => {
    setAvisoR("");
    setExito("");
    if (nuevaR.length < MIN_LARGO) {
      setAvisoR(t("La nueva contraseña debe tener al menos 10 caracteres."));
      return;
    }
    if (nuevaR !== repetidaR) {
      setAvisoR(t("Las dos contraseñas no coinciden."));
      return;
    }
    setOcupado(true);
    const nuevoCodigo = await resetVaultPassword(codigo.trim(), nuevaR);
    setOcupado(false);
    if (!nuevoCodigo) {
      setAvisoR(t("El código de recuperación no es correcto."));
      return;
    }
    setCodigo("");
    setNuevaR("");
    setRepetidaR("");
    setRestableciendo(false);
    setExito(t("Contraseña restablecida. Guarda tu código nuevo."));
    /* El código usado deja de valer, así que hay que enseñar el nuevo sí o sí:
       sin él, olvidar otra vez la contraseña significa perder los chats. */
    show({ modalContent: <RecoveryCodeModal codigo={nuevoCodigo} />, withScroll: true });
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

      {/* Restablecer con el código: el camino para quien NO recuerda la
          contraseña actual, así que funciona también con la bóveda bloqueada.
          Va plegado para no competir con el formulario normal. */}
      <Box sx={{ marginTop: 2, maxWidth: 380 }}>
        {!restableciendo ? (
          <Button
            auto
            light
            size="sm"
            onPress={() => {
              setRestableciendo(true);
              setAvisoR("");
            }}
          >
            {t("He olvidado mi contraseña de cifrado")}
          </Button>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography fontFamily={"Open Sans"} fontSize={15} style={{ color: "#3C3C3C" }}>
              {t("Restablecer con el código de recuperación")}
            </Typography>
            <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#6B6B6B" }}>
              {t("Introduce el código que guardaste al activar el cifrado y elige una contraseña nueva. Tus chats no se vuelven a cifrar: siguen intactos.")}
            </Typography>

            <Input
              aria-label={t("Código de recuperación")}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <Input.Password
              aria-label={t("Nueva contraseña")}
              placeholder={t("Nueva contraseña")}
              value={nuevaR}
              onChange={(e) => setNuevaR(e.target.value)}
            />
            <Input.Password
              aria-label={t("Repite la nueva contraseña")}
              placeholder={t("Repite la nueva contraseña")}
              value={repetidaR}
              onChange={(e) => setRepetidaR(e.target.value)}
            />

            {avisoR && (
              <Typography fontFamily={"Open Sans"} fontSize={14} style={{ color: "#B23B3B" }}>
                {avisoR}
              </Typography>
            )}

            <Typography fontFamily={"Open Sans"} fontSize={13} style={{ color: "#6B6B6B" }}>
              {t("Al restablecerla se te dará un código de recuperación nuevo y el anterior dejará de servir.")}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                auto
                onPress={onRestablecer}
                disabled={ocupado || !codigo || !nuevaR}
              >
                {ocupado ? (
                  <Loading type="points" color="currentColor" size="sm" />
                ) : (
                  t("Restablecer contraseña")
                )}
              </Button>
              <Button auto light onPress={() => setRestableciendo(false)} disabled={ocupado}>
                {t("Ahora no")}
              </Button>
            </Box>
          </Box>
        )}
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
