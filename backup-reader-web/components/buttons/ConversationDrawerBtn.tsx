import { FC } from "react";
import { Button, Typography } from "@mui/material";

type ConversationDrawerBtnProps = {
  drawerButtonOnPress: () => void;
};

export const ConversationDrawerBtn: FC<ConversationDrawerBtnProps> = ({
  drawerButtonOnPress,
}) => {
  return (
    <Button
      variant="contained"
      style={{
        marginTop: 10,
        textTransform: "none",
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        backgroundColor: "var(--ink-900)",
      }}
      onClick={drawerButtonOnPress}
    >
      <Typography
        fontFamily={"Open Sans"}
        fontSize={12}
        style={{ color: "white" }}
      >
        {"< "} Chats
      </Typography>
    </Button>
  );
};
