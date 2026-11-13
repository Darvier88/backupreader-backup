import { FC, useContext } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Button } from "@nextui-org/react";

import { AuthContext, FirestoreContext } from "../../context";
import { VaultPasswordSection } from "../vault";
import { SubscriptionSection } from "../account/SubscriptionSection";
import { useEspacioOcupado } from "../../hooks/useEspacioOcupado";
import { tamanoLegible } from "../../lib/tamano-legible";

export const AccountScreen: FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useContext(FirestoreContext);
  const espacio = useEspacioOcupado();
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

      {/* Cuánto ocupan los chats guardados. Mientras carga no se enseña
          nada: mejor un hueco un instante que un «0 B» que no es verdad. */}
      <Box sx={{ minHeight: 64 }}>
        <Typography fontFamily={"var(--font-serif)"} fontSize={18} style={{ color: "var(--ink-900)" }}>
          {t("Almacenamiento")}
        </Typography>
        {espacio && (
          <>
            <Typography fontFamily={"var(--font-sans)"} fontSize={15} style={{ color: "var(--ink-900)", margin: "8px 0 2px" }}>
              {t("Tus chats ocupan {{tam}}", { tam: tamanoLegible(espacio.bytes, i18n.language) })}
            </Typography>
            <Typography fontFamily={"var(--font-sans)"} fontSize={14} style={{ color: "var(--slate-500)" }}>
              {espacio.chats === 1
                ? t("1 chat guardado")
                : t("{{n}} chats guardados", { n: espacio.chats })}
            </Typography>
          </>
        )}
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
