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
    color: "var(--ink-900)",
  },
  text: {
    marginTop: 1,
    letterSpacing: 0.5,
    color: "var(--ink-900)",
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
        fontFamily={"var(--font-serif)"}
      >
        {title}
      </Typography>
      <Typography
        fontSize={14}
        sx={{ ...styles.text, textAlign: phone ? "center" : "initial" }}
        fontFamily={"var(--font-sans)"}
      >
        {text}
      </Typography>
    </div>
  );
};
