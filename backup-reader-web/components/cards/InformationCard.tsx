import { FC } from "react";
import { Box, Button, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DoDisturbAltOutlinedIcon from "@mui/icons-material/DoDisturbAltOutlined";

const styles = {
  cardPaymentContainer: {
    backgroundColor: "white",
    borderRadius: 3,
    width: 400,
    padding: 3,
    boxShadow: "1px 1px 5px #78909c",
  },
  title: {
    letterSpacing: 0.5,
    color: "#3C3C3C",
  },
};

type InformationCardPros = {
  title: string;
  icon: "success" | "denied";
  onPress: () => void;
};

export const InformationCard: FC<InformationCardPros> = ({
  onPress,
  title,
  icon,
}) => {
  return (
    <Box
      sx={{
        ...styles.cardPaymentContainer,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography fontFamily={"PT Serif"} fontSize={20} style={styles.title}>
          {title}
        </Typography>
        {icon === "success" ? (
          <CheckCircleOutlinedIcon color="success" style={{ fontSize: 50 }} />
        ) : (
          <DoDisturbAltOutlinedIcon color="error" style={{ fontSize: 50 }} />
        )}
      </Box>
      <Button
        color={icon === "denied" ? "error" : "success"}
        variant="contained"
        onClick={onPress}
        style={{
          textTransform: "none",
          width: "100%",
          marginTop: 30,
        }}
      >
        Continuar
      </Button>
    </Box>
  );
};
