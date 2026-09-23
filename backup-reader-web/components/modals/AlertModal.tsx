import { Typography } from "@mui/material";

import React, { useContext } from "react";
import { ModalContext } from "../../context";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@nextui-org/react";

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
  return (
    <>
      <Modal.Header>
        <Typography fontFamily={"Open Sans"} fontSize={18}>
          {title}
        </Typography>
      </Modal.Header>
      <Modal.Body>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ textAlign: "center" }}
        >
          {text}
        </Typography>
      </Modal.Body>
      <Modal.Footer justify="center">
        <Button
          bordered
          auto
          onPress={onHandleHide}
          style={{ color: "grey", borderColor: "grey" }}
        >
          {t("Cancelar")}
        </Button>
        <Button auto onPress={onPress}>
          {t("Continuar")}
        </Button>
      </Modal.Footer>
    </>
  );
};
