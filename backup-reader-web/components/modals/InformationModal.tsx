import React, { useContext } from "react";
import { Typography } from "@mui/material";
import { ModalContext } from "../../context";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@nextui-org/react";

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
  return (
    <>
      <Modal.Header>
        <Typography
          fontFamily={"PT Serif"}
          fontSize={18}
          style={{ color: "#3C3C3C" }}
        >
          {title}
        </Typography>
      </Modal.Header>
      <Modal.Body>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={18}
          style={{ textAlign: "center", color: "#3C3C3C" }}
        >
          {text}
        </Typography>
      </Modal.Body>
      <Modal.Footer justify="center">
        <Button auto onPress={onHandleHide}>
          {t("Continuar")}
        </Button>
      </Modal.Footer>
    </>
  );
};
