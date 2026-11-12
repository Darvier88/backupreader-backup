import React, { useContext } from "react";
import { Typography } from "@mui/material";
import { ModalContext } from "../../context";
import { useTranslation } from "react-i18next";
import { Modal } from "@nextui-org/react";

type InformationModalProps = {
  title: string;
  text: string;
};

export const InformationModal: React.FC<InformationModalProps> = ({
  title,
  text,
}) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const onHandleHide = () => {
    hide();
  };
  /* Mismo estilo que el resto de avisos del rediseño (p. ej. «Subiendo
     chat»): título en serif y tinta, texto en la sans del sistema de diseño
     en pizarra, y el botón principal de la marca. Antes iba en PT Serif /
     Open Sans con gris #3C3C3C y el botón de NextUI, que se veía más claro
     y con otra letra. */
  return (
    <>
      <Modal.Header css={{ paddingTop: 24 }}>
        <Typography
          fontFamily={"var(--font-serif)"}
          fontSize={22}
          style={{ color: "var(--ink-900)" }}
        >
          {title}
        </Typography>
      </Modal.Header>
      <Modal.Body>
        {/* Texto igual que el de «Subiendo chat» (LoadingComponent): la
            letra del tema, 14.5 px, pizarra e interlineado 1.55. */}
        <Typography
          fontSize={14.5}
          style={{ textAlign: "center", color: "var(--slate-700)", lineHeight: 1.55 }}
        >
          {text}
        </Typography>
      </Modal.Body>
      <Modal.Footer justify="center" css={{ paddingBottom: 22 }}>
        <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={onHandleHide} autoFocus>
          {t("Continuar")}
        </button>
      </Modal.Footer>
    </>
  );
};
