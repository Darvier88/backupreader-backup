import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loading } from "@nextui-org/react";

import { ModalContext } from "../../context";
import { useVault } from "../../context/VaultContext";
import { RecoveryCodeModal } from "./RecoveryCodeModal";
import { VaultRegisterModal } from "./VaultRegisterModal";
import { SeccionCuenta } from "../account/SeccionCuenta";

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
  const {
    status,
    changeVaultPassword,
    resetVaultPassword,
    regenerateRecovery,
    lock,
    recordadaEnEsteDispositivo,
    olvidarEsteDispositivo,
  } = useVault();

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

  const texto = { fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.45, color: "var(--slate-700)" } as const;

  if (status === "none") {
    return (
      <SeccionCuenta etiqueta={t("Cifrado")}>
        <span style={texto}>{t("Todavía no has activado el cifrado de tus chats.")}</span>
        <div>
          <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={() => show({ modalContent: <VaultRegisterModal /> })}>
            {t("Activar cifrado")}
          </button>
        </div>
      </SeccionCuenta>
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
  const aviso_ = (txt: string, color: string) =>
    txt ? <span style={{ ...texto, color }}>{txt}</span> : null;

  return (
    <>
      <SeccionCuenta etiqueta={t("Cifrado")}>
        {/* «Olvidar este dispositivo»: la salida de «Recordar 30 días» (8a).
            Quien marcó la casilla tiene que poder deshacerlo sin esperar a que
            venza ni cerrar sesión. */}
        {recordadaEnEsteDispositivo && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--paper-100)",
            }}
          >
            <span style={{ ...texto, flex: "1 1 220px", fontSize: 14 }}>
              {t("Este dispositivo recuerda tu clave de cifrado hasta 30 días.")}
            </span>
            <button type="button" className="br-btn br-btn-ghost br-btn-sm" onClick={() => void olvidarEsteDispositivo()}>
              {t("Olvidar este dispositivo")}
            </button>
          </div>
        )}

        {!restableciendo ? (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)", paddingTop: 6 }}>
              {t("Cambiar clave de cifrado")}
            </div>
            <div className="br-cuenta-campos">
              <CampoClave valor={actual} onValor={setActual} etiqueta={t("Clave actual")} autoComplete="current-password" />
              <CampoClave valor={nueva} onValor={setNueva} etiqueta={t("Clave nueva")} autoComplete="new-password" />
              <CampoClave valor={repetida} onValor={setRepetida} etiqueta={t("Repite la clave nueva")} autoComplete="new-password" />
            </div>
            {aviso_(aviso, "var(--clay-600)")}
            {aviso_(exito, "var(--brass-600)")}
            <div className="br-cuenta-acciones">
              <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={onCambiar} disabled={ocupado || !actual || !nueva}>
                {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Cambiar clave")}
              </button>
              {/* Restablecer con el código: el camino para quien NO recuerda la
                  clave actual, así que funciona también con la bóveda bloqueada. */}
              <button type="button" className="br-enlace-texto" onClick={() => { setRestableciendo(true); setAvisoR(""); }}>
                {t("Olvidé mi clave de cifrado")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)", paddingTop: 6 }}>
              {t("Restablecer con el código de recuperación")}
            </div>
            <span style={texto}>
              {t("Introduce el código que guardaste al activar el cifrado y elige una contraseña nueva. Tus chats no se vuelven a cifrar: siguen intactos.")}
            </span>
            <div className="br-cuenta-campos">
              <CampoClave valor={codigo} onValor={setCodigo} etiqueta={t("Código de recuperación")} visible autoComplete="off" />
              <CampoClave valor={nuevaR} onValor={setNuevaR} etiqueta={t("Clave nueva")} autoComplete="new-password" />
              <CampoClave valor={repetidaR} onValor={setRepetidaR} etiqueta={t("Repite la clave nueva")} autoComplete="new-password" />
            </div>
            {aviso_(avisoR, "var(--clay-600)")}
            <span style={{ ...texto, fontSize: 13, color: "var(--slate-500)" }}>
              {t("Al restablecerla se te dará un código de recuperación nuevo y el anterior dejará de servir.")}
            </span>
            <div className="br-cuenta-acciones">
              <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={onRestablecer} disabled={ocupado || !codigo || !nuevaR}>
                {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Restablecer clave")}
              </button>
              <button type="button" className="br-enlace-texto" onClick={() => setRestableciendo(false)} disabled={ocupado}>
                {t("Ahora no")}
              </button>
            </div>
          </>
        )}
      </SeccionCuenta>

      <SeccionCuenta etiqueta={t("Código de recuperación")}>
        <span style={texto}>
          {t("Generar uno nuevo invalida el anterior. Tus chats deben estar desbloqueados.")}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="br-btn br-btn-ghost br-btn-md" onClick={onRegenerar} disabled={ocupado || bloqueada}>
            {t("Generar código nuevo")}
          </button>
          {/* Bloquear a mano también olvida la clave recordada: si no, al
              recargar se volvería a abrir sola y el botón no serviría. */}
          {!bloqueada && (
            <button type="button" className="br-enlace-texto" style={{ alignSelf: "center", marginLeft: 8 }} onClick={() => { void olvidarEsteDispositivo(); lock(); }}>
              {t("Bloquear ahora")}
            </button>
          )}
        </div>
      </SeccionCuenta>
    </>
  );
};

/** Campo de clave como el de la pantalla de desbloqueo: 46 px, con el ojo
 *  para verla en vez de pedir que se repita a ciegas. */
const CampoClave: React.FC<{
  valor: string;
  onValor: (v: string) => void;
  etiqueta: string;
  autoComplete: string;
  visible?: boolean;
}> = ({ valor, onValor, etiqueta, autoComplete, visible = false }) => {
  const { t } = useTranslation();
  const [verla, setVerla] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        aria-label={etiqueta}
        placeholder={etiqueta}
        type={visible || verla ? "text" : "password"}
        value={valor}
        autoComplete={autoComplete}
        onChange={(e) => onValor(e.target.value)}
        style={{
          width: "100%",
          height: 46,
          padding: visible ? "0 14px" : "0 48px 0 14px",
          background: "#fff",
          border: "1.5px solid var(--border)",
          borderRadius: 8,
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: "var(--ink-900)",
        }}
      />
      {!visible && (
        <button
          type="button"
          aria-label={(t(verla ? "Ocultar contraseña" : "Ver contraseña") as string) ?? ""}
          onClick={() => setVerla((v) => !v)}
          style={{ position: "absolute", right: 3, top: 3, width: 40, height: 40, background: "transparent", border: "none", cursor: "pointer", color: "var(--slate-500)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {verla ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M1 1l22 22" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      )}
    </div>
  );
};
