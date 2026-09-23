import { Typography } from "@mui/material";
import { Button, useTheme } from "@nextui-org/react";

interface BlockButtonProps {
  title: string;
  color?: string;
  width?: number;
  colorText?: string;
  disabled?: boolean;
  onPress?: () => void;
  borderColor?: string;
  navButton?: boolean;
  type?: "bordered" | "light";
  size?: "sm" | "lg" | "md" | "xl" | "xs";
}

const styles = {
  blockButtoStyles: {
    borderColor: "grey",
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    height: 40,
    borderWidth: 1,
  },
};

export const BlockButton: React.FC<BlockButtonProps> = ({
  color,
  title,
  onPress,
  width = 300,
  size = "md",
  disabled = false,
  navButton = false,
  type = "bordered",
  colorText = "white",
  borderColor = "#E6E6E6",
}) => {
  const { theme } = useTheme();
  return (
    <Button
      size={size}
      bordered={type === "bordered" ? true : false}
      light={type === "light" ? true : false}
      disabled={disabled}
      style={{
        ...styles.blockButtoStyles,
        color: disabled
          ? "black"
          : type === "light"
          ? theme?.colors.blue800.value
          : colorText,
        backgroundColor: disabled
          ? "#E6E6E6"
          : color
          ? color
          : type === "light"
          ? "transparent"
          : "#0F52BA", //theme?.colors.blue800.value
        width: width,
        borderColor: disabled || navButton ? borderColor : "transparent",
        padding: 0,
      }}
      onPress={onPress}
    >
      <Typography fontSize={13} fontFamily={"Open Sans"} color={'#FFFFFF'}>
        {title}
      </Typography>
    </Button>
  );
};
