import { Modal } from "@nextui-org/react";
import { Typography } from "@mui/material";
import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalContext } from "../../context";
import type { HiloDelZip } from "../../lib/backupreader-crypto/hilosInstagram";
import { tamanoLegible } from "../../lib/tamano-legible";

/**
 * Elegir qué conversación de un export de Instagram se sube.
 *
 * El zip de Instagram trae TODAS, y subirlas todas significaría pagar
 * almacenamiento por conversaciones que nadie pidió guardar, además de que el
 * chat que se abriera sería uno cualquiera de entre ellas.
 *
 * La lista va de la más pesada a la más ligera: quien baja su Instagram suele
 * venir a por una conversación concreta, y casi siempre es de las grandes.
 */
export const ElegirConversacion: React.FC<{
  hilos: HiloDelZip[];
  onElegir: (hilo: HiloDelZip) => void;
  onCancelar?: () => void;
}> = ({ hilos, onElegir, onCancelar }) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const [elegido, setElegido] = useState<string>(hilos[0]?.prefijo || "");

  const cerrar = () => {
    hide();
    onCancelar?.();
  };

  const confirmar = () => {
    const hilo = hilos.find((h) => h.prefijo === elegido);
    if (!hilo) return;
    hide();
    onElegir(hilo);
  };

  return (
    <>
      <Modal.Header css={{ paddingTop: 24, flexDirection: "column", gap: 6 }}>
        <Typography
          fontFamily={"var(--font-serif)"}
          fontSize={22}
          style={{ color: "var(--ink-900)" }}
        >
          {t("¿Qué conversación quieres guardar?")}
        </Typography>
        <Typography fontSize={13.5} style={{ color: "var(--slate-700)", textAlign: "center" }}>
          {t(
            "Tu descarga de Instagram trae todas tus conversaciones. Se guarda solo la que elijas."
          )}
        </Typography>
      </Modal.Header>

      <Modal.Body css={{ paddingTop: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "48vh", overflowY: "auto" }}>
          {hilos.map((hilo) => {
            const activo = hilo.prefijo === elegido;
            return (
              <button
                type="button"
                key={hilo.prefijo}
                onClick={() => setElegido(hilo.prefijo)}
                aria-pressed={activo}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: activo ? "var(--sage-100, #e6efe9)" : "transparent",
                  border: `1px solid ${activo ? "var(--sage-500, #5f8d72)" : "var(--border)"}`,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-sans)",
                      fontSize: 14.5,
                      color: "var(--ink-900)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hilo.nombre}
                  </span>
                  {/* De dónde sale, cuando no es la bandeja de siempre: una
                      conversación archivada o una solicitud se reconoce mal
                      solo por el nombre. */}
                  {hilo.bandeja !== "inbox" && (
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-500)" }}
                    >
                      {hilo.bandeja === "archived_threads"
                        ? t("archivada")
                        : t("solicitud de mensaje")}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--slate-500)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tamanoLegible(hilo.bytes)}
                </span>
              </button>
            );
          })}
        </div>
      </Modal.Body>

      <Modal.Footer justify="center" css={{ gap: 10, paddingBottom: 22 }}>
        <button type="button" className="br-btn br-btn-ghost br-btn-md" onClick={cerrar}>
          {t("Cancelar")}
        </button>
        <button
          type="button"
          className="br-btn br-btn-primary br-btn-md"
          onClick={confirmar}
          disabled={!elegido}
        >
          {t("Guardar esta")}
        </button>
      </Modal.Footer>
    </>
  );
};

export default ElegirConversacion;
