import { FC } from "react";
import { Typography } from "@mui/material";

const styles = {
  dividerContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 10,
    width: 300,
  },
  dividerLine: {
    width: 100,
    height: 1,
    backgroundColor: "black",
  },
};

export const Divider: FC = () => {
  return (
    <>
      <div style={{ ...styles.dividerContainer, flexDirection: "row" }}>
        <div style={styles.dividerLine} />
        <Typography
          style={{ color: "#3C3C3C" }}
          fontSize={10}
          fontFamily={"Open Sans"}
        >
          o
        </Typography>
        <div style={styles.dividerLine} />
      </div>
    </>
  );
};
