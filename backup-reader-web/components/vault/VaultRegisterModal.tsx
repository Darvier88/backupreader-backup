import React, { useContext, useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input, Loading } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";
import { RecoveryCodeModal } from "./RecoveryCodeModal";
import { MedidorDeClave } from "./MedidorDeClave";
import { medirFuerza, coinciden, MIN_LARGO } from "../../lib/fuerza-de-clave";

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/* El mínimo y el medidor viven en lib/fuerza-de-clave.ts, porque son reglas
   sobre la clave y no sobre este modal. */

export const VaultRegisterModal: React.FC = () => {
  const { t } = useTranslation();
  const { show, hide } = useContext(ModalContext);
  const { registerVault } = useVault();

  /* Dos pasos en vez de dos campos juntos (5a y 5b).
   *
   * Con los dos campos a la vista, repetir la clave es copiar lo de arriba:
   * se ve mientras se escribe, así que no confirma que se recuerde, que es lo
   * único para lo que sirve el segundo campo. En su propia pantalla, sin el
   * primero delante, sí lo confirma. */
  const [paso, setPaso] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [entiendo, setEntiendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const fuerza = medirFuerza(password);
  const igualan = coinciden(password, repetida);

  const onContinuar = () => {
    if (!fuerza.valida) {
      setAviso(enTexto(t("La clave debe tener al menos {{n}} caracteres.", { n: MIN_LARGO })));
      return;
    }
    setAviso("");
    setPaso(2);
  };

  const onCrear = async () => {
    if (!igualan) {
      setAviso(enTexto(t("Las dos contraseñas no coinciden.")));
      return;
    }
    if (!entiendo) {
      setAviso(enTexto(t("Marca la casilla para continuar.")));
      return;
    }

    setAviso("");
    setOcupado(true);
    const codigo = await registerVault(password);
    setOcupado(false);

    if (!codigo) {
      setAviso(enTexto(t("No se pudo crear la protección. Inténtalo de nuevo.")));
      return;
    }
    // El código se muestra UNA sola vez, en su propio modal.
    show({ modalContent: <RecoveryCodeModal codigo={codigo} />, withScroll: true });
  };

  return (
    <>
      <Modal.Header>
        <div style={{ width: "100%", textAlign: "left" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)" }}>
            {enTexto(t("Paso {{n}} de 3", { n: paso + 1 }))}
          </span>
          <Typography fontFamily={"var(--font-serif)"} fontSize={21} style={{ color: "var(--ink-900)", marginTop: 4 }}>
            {paso === 1 ? t("Crea tu clave de cifrado") : t("Escríbela otra vez")}
          </Typography>
        </div>
      </Modal.Header>

      <Modal.Body>
        {paso === 1 ? (
          <>
            <Typography fontFamily={"var(--font-sans)"} fontSize={15} style={{ color: "var(--slate-700)", marginBottom: 10 }}>
              {t("Con ella ciframos tus chats en tu teléfono antes de guardarlos. Nosotros no la conocemos.")}
            </Typography>

            <Input.Password
              fullWidth
              autoFocus
              aria-label={enTexto(t("Clave de cifrado"))}
              placeholder={enTexto(t("Clave de cifrado"))}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <MedidorDeClave clave={password} />

            <Typography fontFamily={"var(--font-sans)"} fontSize={13.5} style={{ color: "var(--slate-500)", marginTop: 12 }}>
              {t("Si la olvidas, no podremos abrir tus chats. Guárdala en un lugar seguro.")}
            </Typography>
          </>
        ) : (
          <>
            <Typography fontFamily={"var(--font-sans)"} fontSize={15} style={{ color: "var(--slate-700)", marginBottom: 10 }}>
              {t("Así confirmamos que la recuerdas bien.")}
            </Typography>

            <Input.Password
              fullWidth
              autoFocus
              aria-label={enTexto(t("Confirma tu clave"))}
              placeholder={enTexto(t("Confirma tu clave"))}
              value={repetida}
              onChange={(e) => {
                setRepetida(e.target.value);
                setAviso("");
              }}
            />

            {/* Verificación en vivo: esperar al botón para decir que no
                coinciden obliga a reescribir las dos. */}
            {repetida.length > 0 && (
              <span
                style={{
                  display: "block",
                  marginTop: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: igualan ? "var(--accent, #2E7D5B)" : "var(--aviso-texto)",
                }}
              >
                {igualan ? t("Las claves coinciden") : t("Las claves no coinciden")}
              </span>
            )}

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={entiendo}
                onChange={(e) => setEntiendo(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.5, color: "var(--slate-700)" }}>
                {t("Entiendo que, si pierdo esta clave, mis chats no se pueden recuperar.")}
              </span>
            </label>
          </>
        )}

        {aviso && (
          <Typography fontFamily={"var(--font-sans)"} fontSize={14} style={{ color: "var(--aviso-texto)", marginTop: 10 }}>
            {aviso}
          </Typography>
        )}
      </Modal.Body>

      <Modal.Footer justify="center">
        {paso === 1 ? (
          <>
            <Button auto light onPress={hide} disabled={ocupado}>
              {t("Ahora no")}
            </Button>
            <Button auto onPress={onContinuar} disabled={ocupado}>
              {t("Continuar")}
            </Button>
          </>
        ) : (
          <>
            <Button auto light onPress={() => { setPaso(1); setAviso(""); }} disabled={ocupado}>
              {t("Atrás")}
            </Button>
            <Button auto onPress={onCrear} disabled={ocupado || !igualan || !entiendo}>
              {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Guardar clave")}
            </Button>
          </>
        )}
      </Modal.Footer>
    </>
  );
};
