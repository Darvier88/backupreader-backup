import { Typography } from "@mui/material";

import React, { useContext } from "react";
import { ModalContext } from "../../context";
import { useTranslation } from "react-i18next";
import { Modal } from "@nextui-org/react";

type AlertModalProps = {
  title: string;
  text: string;
  onPress: () => void;
};

export const AlertModal: React.FC<AlertModalProps> = ({
  title,
  text,
  onPress,
}) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const onHandleHide = () => {
    hide();
  };
  /* Mismo estilo que InformationModal y el resto del rediseño. */
  return (
    <>
      <Modal.Header css={{ paddingTop: 24 }}>
        <Typography fontFamily={"var(--font-serif)"} fontSize={22} style={{ color: "var(--ink-900)" }}>
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
      <Modal.Footer justify="center" css={{ gap: 10, paddingBottom: 22 }}>
        <button type="button" className="br-btn br-btn-ghost br-btn-md" onClick={onHandleHide}>
          {t("Cancelar")}
        </button>
        <button type="button" className="br-btn br-btn-primary br-btn-md" onClick={onPress}>
          {t("Continuar")}
        </button>
      </Modal.Footer>
    </>
  );
};
