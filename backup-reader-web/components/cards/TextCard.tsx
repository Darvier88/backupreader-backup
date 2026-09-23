import { FC } from "react";
import { Text } from "@nextui-org/react";
import Image from "next/image";
import { Theme, Typography, useMediaQuery } from "@mui/material";

interface TextCardProps {
  title: string;
  text: string;
  image: string;
  imageHeight: number;
  imageWight: number;
  alignVertical?: boolean;
}

const styles = {
  container: {
    width: 300,
    height: 200,
  },
  title: {
    marginTop: 3,
    letterSpacing: 0.5,
    color: "#3C3C3C",
  },
  text: {
    marginTop: 1,
    letterSpacing: 0.5,
    color: "#3C3C3C",
  },
};

export const TextCard: FC<TextCardProps> = ({
  title,
  text,
  image,
  imageHeight,
  imageWight,
  alignVertical = false,
}) => {
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );
  return (
    <div style={styles.container}>
      <div
        style={{
          display: "flex",
          alignItems: alignVertical ? "flex-start" : "center",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Image
          alt=""
          width={imageWight}
          height={imageHeight}
          src={`/images/${image}`}
        />
      </div>
      <Typography
        fontSize={18}
        sx={{ ...styles.title, textAlign: phone ? "center" : "initial" }}
        fontFamily={"PT Serif"}
      >
        {title}
      </Typography>
      <Typography
        fontSize={14}
        sx={{ ...styles.text, textAlign: phone ? "center" : "initial" }}
        fontFamily={"Open Sans"}
      >
        {text}
      </Typography>
    </div>
  );
};
