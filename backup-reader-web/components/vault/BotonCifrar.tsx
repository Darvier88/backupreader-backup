import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext } from "../../context/StorageContext";
import { VaultContext } from "../../context/VaultContext";

/**
 * Botón "Cifrar" para los backups que todavía están en texto plano (v1).
 *
 * Vive dentro de cada fila de la barra lateral, en el sitio donde los backups
 * ya cifrados muestran la flecha. Es deliberadamente pequeño: la migración es
 * algo que el usuario hace una vez por chat y después desaparece para siempre.
 *
 * Confirma en dos pasos en vez de abrir un diálogo: al terminar se borra el
 * original, y aunque eso solo ocurre después de verificar que la copia cifrada
 * se puede releer, conviene que nadie lo dispare de un clic accidental.
 */
export const BotonCifrar = ({ fullPath, name }: { fullPath: string; name: string }) => {
  const { t } = useTranslation();
  const { migrarBackup, migracion } = useContext(StorageContext);
  const { dek } = useContext(VaultContext);
  const [confirmando, setConfirmando] = useState(false);

  const esta = migracion?.fullPath === fullPath;
  const otraEnCurso = !!migracion && !esta;

  /* Sin la bóveda abierta no hay con qué cifrar. El VaultBanner ya le dice al
     usuario qué hacer, así que aquí basta con explicar por qué no se puede. */
  if (!dek) {
    return (
      <span style={{ ...base, color: "var(--slate-500)", borderColor: "transparent" }}>
        {t("Desbloquea para cifrar")}
      </span>
    );
  }

  if (esta) {
    const pct =
      migracion!.total > 0
        ? Math.round((migracion!.hechas / migracion!.total) * 100)
        : null;

    const etiqueta: Record<string, string> = {
      listando: t("Leyendo…"),
      cifrando: pct === null ? t("Cifrando…") : `${t("Cifrando")} ${pct}%`,
      verificando: t("Verificando…"),
      borrando: t("Limpiando…"),
    };

    return (
      <span style={{ ...base, color: "var(--brass-600)", borderColor: "var(--brass-500)" }}>
        {etiqueta[migracion!.fase]}
      </span>
    );
  }

  const alPulsar = (e: React.MouseEvent) => {
    // Sin esto, el clic burbujea a la fila y abre el chat.
    e.stopPropagation();
    if (otraEnCurso) return;
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setConfirmando(false);
    void migrarBackup(fullPath, name);
  };

  return (
    <button
      type="button"
      onClick={alPulsar}
      onMouseLeave={() => setConfirmando(false)}
      disabled={otraEnCurso}
      title={t("Este chat está guardado sin cifrar. Al cifrarlo, el original se borra del servidor.")}
      style={{
        ...base,
        cursor: otraEnCurso ? "default" : "pointer",
        opacity: otraEnCurso ? 0.45 : 1,
        color: confirmando ? "var(--surface)" : "var(--brass-600)",
        background: confirmando ? "var(--brass-600)" : "transparent",
        borderColor: "var(--brass-500)",
      }}
    >
      {confirmando ? t("¿Cifrar y borrar el original?") : t("Sin cifrar · Cifrar")}
    </button>
  );
};

const base: React.CSSProperties = {
  flexShrink: 0,
  whiteSpace: "nowrap",
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.02em",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid",
  lineHeight: 1.2,
};

export default BotonCifrar;
