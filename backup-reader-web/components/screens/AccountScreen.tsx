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
      <Typography fontFamily={"var(--font-serif)"} fontSize={26} style={{ color: "var(--ink-900)" }}>
        {t("Mi cuenta")}
      </Typography>

      <Box sx={{ marginTop: 2 }}>
        {user?.displayName && (
          <Typography fontFamily={"var(--font-sans)"} fontSize={16} style={{ color: "var(--ink-900)" }}>
            {user.displayName}
          </Typography>
        )}
        <Typography fontFamily={"var(--font-sans)"} fontSize={15} style={{ color: "var(--slate-500)" }}>
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
