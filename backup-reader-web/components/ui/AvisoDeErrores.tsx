import React, { useContext } from "react";
import { useTranslation } from "react-i18next";

import { ModalContext } from "../../context";
import { StorageContext } from "../../context/StorageContext";
import { useVault } from "../../context/VaultContext";
import { VaultRegisterModal, VaultUnlockModal } from "../vault";

/**
 * Muestra en pantalla los errores del StorageContext.
 *
 * Existe porque hasta ahora no existía: `errorMessage` se escribía en el
 * reducer y no se pintaba en ningún componente, y tampoco había traducciones
 * para sus códigos. El resultado es que cualquier fallo al subir o al abrir un
 * chat era completamente mudo. Un usuario de pago estuvo días sin poder subir
 * nada —le faltaba crear la bóveda— y la app no se lo dijo ni una vez: el
 * botón simplemente no hacía nada.
 *
 * Los errores de la bóveda NO se tratan aquí: sus modales (registro,
 * desbloqueo) ya muestran los suyos, y duplicarlos daría dos mensajes a la vez.
 *
 * Es un diálogo propio y no el ModalContext a propósito: el contexto solo
 * guarda un modal a la vez, y un error puede ocurrir justo mientras otro
 * diálogo está abierto. Así no se pisan.
 */
export const AvisoDeErrores: React.FC = () => {
  const { t } = useTranslation();
  const { errorMessage, limpiarError } = useContext(StorageContext);
  const { status } = useVault();
  const { show } = useContext(ModalContext);

  if (!errorMessage) return null;

  /** Qué contar al usuario, y qué puede hacer para arreglarlo. */
  const explicar = (): { titulo: string; texto: string; accion?: { texto: string; hacer: () => void } } => {
    switch (errorMessage) {
      case "vault-not-created":
        return {
          titulo: t("Falta activar el cifrado"),
          texto: t(
            "Tus chats se cifran en tu navegador antes de subirse, así que primero tienes que elegir una contraseña de cifrado. Sin ella no hay con qué cifrarlos y la subida no puede empezar."
          ),
          accion: {
            texto: t("Activar cifrado"),
            hacer: () => {
              limpiarError();
              show({ modalContent: <VaultRegisterModal />, width: "min(620px, 94vw)", withScroll: true });
            },
          },
        };

      case "vault-locked":
        return {
          titulo: t("Tus chats están bloqueados"),
          texto: t(
            "Introduce tu contraseña de cifrado para desbloquearlos. Hasta entonces no se pueden subir chats nuevos ni leer los que ya tienes cifrados."
          ),
          accion: {
            texto: t("Desbloquear"),
            hacer: () => {
              limpiarError();
              show({ modalContent: <VaultUnlockModal />, width: "min(620px, 94vw)", withScroll: true });
            },
          },
        };

      case "Error-uploading-file":
        return {
          titulo: t("No se pudo subir el chat"),
          texto: t(
            "Algo falló durante la subida. Suele ser la conexión. Vuelve a intentarlo; lo que se haya subido a medias no se mostrará ni ocupará sitio en tu lista."
          ),
        };

      case "Error-migrating-file":
        return {
          titulo: t("No se pudo cifrar el chat"),
          texto: t(
            "La copia cifrada no se completó, así que el chat original sigue intacto y no se ha borrado nada. Puedes volver a intentarlo cuando quieras."
          ),
        };

      case "error-getting-file-List":
        return {
          titulo: t("No se pudo cargar tu lista de chats"),
          texto: t("Revisa tu conexión y recarga la página."),
        };

      case "Error-getting-file":
        return {
          titulo: t("No se pudo abrir el chat"),
          texto:
            status === "locked"
              ? t("Tus chats están bloqueados. Desbloquéalos con tu contraseña de cifrado para poder leerlos.")
              : t("Revisa tu conexión y vuelve a intentarlo."),
        };

      default:
        /* Código desconocido: se muestra tal cual en vez de callarlo. Un
           mensaje feo es mejor que ninguno. */
        return { titulo: t("Algo salió mal"), texto: errorMessage };
    }
  };

  const { titulo, texto, accion } = explicar();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={limpiarError}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(22,35,59,0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "var(--surface-raised, #fff)",
          borderRadius: 12,
          padding: "28px 28px 22px",
          boxShadow: "0 24px 60px -20px rgba(22,35,59,0.45)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-serif, 'PT Serif')",
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.2,
            color: "var(--ink-900, #16233B)",
          }}
        >
          {titulo}
        </h2>

        <p
          style={{
            margin: "0 0 24px",
            fontFamily: "var(--font-sans, 'Open Sans')",
            fontSize: 15.5,
            lineHeight: 1.6,
            color: "var(--slate-700, #3B4652)",
          }}
        >
          {texto}
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {accion && (
            <button className="br-btn br-btn-primary br-btn-md" onClick={accion.hacer}>
              {accion.texto}
            </button>
          )}
          <button className="br-btn br-btn-ghost br-btn-md" onClick={limpiarError}>
            {accion ? t("Ahora no") : t("Entendido")}
          </button>
        </div>
      </div>
    </div>
  );
};
