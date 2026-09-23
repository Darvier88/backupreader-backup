import { FC } from "react";

import { BlockButton } from "../buttons";
import { useTranslation } from "react-i18next";

import CheckIcon from "@mui/icons-material/Check";
import { Box, Theme, Typography, useMediaQuery } from "@mui/material";

const styles = {
  text: {
    marginTop: 5,
    letterSpacing: 0.5,
    color: "#3C3C3C",
  },
};

interface PlanCardProps {
  name: string;
  price: number;
  storage: number;
  benefit: string;
  description: string;
  frequently: string;
  //onPress: () => void;
  buttonOnPress: () => void;
  //isSelected: boolean;
}

export const PlanCard: FC<PlanCardProps> = ({
  name,
  price = 0,
  storage,
  benefit,
  description,
  frequently = "Mes",
  buttonOnPress,
}) => {
  const { t } = useTranslation();
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid #EBEBEB",
        borderRadius: 10,
        width: 300,
        marginTop: 0,
      }}
    >
      <Typography
        fontSize={phone ? 18 : 20}
        style={styles.text}
        fontWeight={"bold"}
        fontFamily={"Open Sans"}
      >
        {name}
      </Typography>
      <div style={{ marginTop: 10 }}>
        {
          /*
          <Typography fontSize={14} style={styles.text} fontFamily={"Open Sans"}>
            {t(description)}
          </Typography>
          */
        }
        <Typography
          fontWeight={"bold"}
          fontSize={18}
          style={styles.text}
          fontFamily={"Open Sans"}
        >
          $ {price} / {t(frequently)}
        </Typography>

          

        <Box display={"flex"} flexDirection={"row"} sx={{ marginTop: 4 }}>
          <CheckIcon fontSize="small" style={{ color: "#0050C1" }} />
          <Typography
            fontSize={16}
            fontFamily={"Open Sans"}
            style={{ ...styles.text, marginLeft: 5 }}
          >
            {t(benefit)}
          </Typography>
        </Box>

        <Box
          display={"flex"}
          flexDirection={"row"}
          alignItems={"center"}
          sx={{ marginTop: 2 }}
        >
          <CheckIcon fontSize="small" style={{ color: "#0050C1" }} />
          <Typography
            fontSize={16}
            fontWeight={"bold"}
            fontFamily={"Open Sans"}
            style={{ ...styles.text, marginLeft: 5 }}
          >
            Conversaciones hasta {storage} MB
          </Typography>
        </Box>
       

        <div
          style={{
            marginTop: 25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <BlockButton title="Suscríbete" width={120} onPress={buttonOnPress} />
        </div>
      </div>
    </div>
  );
};
