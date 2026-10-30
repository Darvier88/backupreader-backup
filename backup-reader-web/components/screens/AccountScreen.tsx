import { FC, useContext } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button } from "@nextui-org/react";

import { AuthContext, FirestoreContext } from "../../context";
import { VaultPasswordSection } from "../vault";
import { SubscriptionSection } from "../account/SubscriptionSection";

export const AccountScreen: FC = () => {
  const { t } = useTranslation();
  const { user } = useContext(FirestoreContext);
  const { logOut } = useContext(AuthContext);

  return (
    <Box sx={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <Typography fontFamily={"PT Serif"} fontSize={26} style={{ color: "#3C3C3C" }}>
        {t("Mi cuenta")}
      </Typography>

      <Box sx={{ marginTop: 2 }}>
        {user?.displayName && (
          <Typography fontFamily={"Open Sans"} fontSize={16} style={{ color: "#3C3C3C" }}>
            {user.displayName}
          </Typography>
        )}
        <Typography fontFamily={"Open Sans"} fontSize={15} style={{ color: "#6B6B6B" }}>
          {user?.email}
        </Typography>
      </Box>

      <Divider sx={{ margin: "20px 0" }} />

      {/* Plan y cancelación. */}
      <SubscriptionSection />

      <Divider sx={{ margin: "20px 0" }} />

      {/* Contraseña de cifrado, restablecimiento y código de recuperación. */}
      <VaultPasswordSection />

      <Divider sx={{ margin: "24px 0 16px" }} />

      <Button auto light color="error" onPress={logOut}>
        {t("Cerrar sesión")}
      </Button>
    </Box>
  );
};
