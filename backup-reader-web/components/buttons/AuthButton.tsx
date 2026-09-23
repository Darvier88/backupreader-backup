import { FC } from "react";

import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { Typography } from "@mui/material";
import { Button } from "@nextui-org/react";
import { useTranslation } from "react-i18next";

interface authButtonProps {
  signInWith: "google" | "appleID" | "email";
  onClick?: () => void;
}

const styles = {
  authButtoStyles: {
    color: "grey",
    borderColor: "grey",
    borderRadius: 10,
    width: 300,
    marginTop: 5,
    marginBottom: 5,
    height: 40,
    borderWidth: 1,
  },
};

export const AuthButton: FC<authButtonProps> = ({
  onClick,
  signInWith = "email",
}) => {
  const { t } = useTranslation();

  return (
    <Button bordered style={styles.authButtoStyles} onPress={onClick}>
      {signInWith === "email" ? (
        <Typography fontSize={14} fontFamily={"Open Sans"}>
          {t("Continuar con email")}
        </Typography>
      ) : signInWith === "google" ? (
        <Typography
          fontSize={14}
          fontFamily={"Open Sans"}
          style={{ display: "flex", alignItems: "center" }}
        >
          <FcGoogle size={17} style={{ marginRight: 5 }} /> {t("Iniciar con Google")}
        </Typography>
      ) : (
        <Typography
          fontSize={14}
          fontFamily={"Open Sans"}
          style={{ display: "flex", alignItems: "center" }}
        >
          <FaApple size={17} style={{ marginRight: 5 }} /> Iniciar con AppleId
        </Typography>
      )}
    </Button>
  );
};
