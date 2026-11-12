import { FC } from "react";
import { useRouter } from "next/router";
import { Grid } from "@nextui-org/react";
import { ManageFileCard } from "../cards";
import { Button, Theme, Typography, useMediaQuery } from "@mui/material";

const styles = {
  container: {
    width: "100%",
  },
  title: {
    marginTop: 15,
    fontFamily: "PT_Serif",
    letterSpacing: 0.5,
  },
  text: {
    marginTop: 1,
    fontFamily: "Sukhumvit_Set",
    letterSpacing: 0.5,
    color: "var(--ink-900)",
  },
};

export const InitialDashboardScreen: FC = () => {
  const router = useRouter();
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );
  return (
    <Grid.Container>
      <Grid xs={12}>
        <ManageFileCard isFirstFile chat />
      </Grid>
      <Grid xs={12}>
        <div
          style={{
            ...styles.container,
            bottom: 10,
            position: "fixed",
          }}
        >
          {phone ? (
            <Typography
              fontSize={10}
              fontFamily={"var(--font-sans)"}
              style={{ color: "var(--ink-900)", textAlign: "center" }}
            >
              Privacy Policy and Terms of Service.
            </Typography>
          ) : (
            <Typography
              fontSize={12}
              fontFamily={"var(--font-sans)"}
              style={{ color: "var(--ink-900)", textAlign: "center" }}
            >
              <Button
                style={{ textTransform: "none" }}
                onClick={() => router.push("/termsConditions")}
              >
                <Typography
                  fontSize={12}
                  fontFamily={"var(--font-sans)"}
                  style={{ color: "var(--ink-900)" }}
                >
                  Terminos del Servicio
                </Typography>
              </Button>
              |{" "}
              <Button
                style={{ textTransform: "none" }}
                onClick={() => router.push("/privacyPolicy")}
              >
                <Typography
                  fontSize={12}
                  fontFamily={"var(--font-sans)"}
                  style={{ color: "var(--ink-900)" }}
                >
                  Política de Privacidad{" "}
                </Typography>
              </Button>{" "}
              | Ⓒ Copyright Backup ReaderLLC, Todos los derechos reservados.
            </Typography>
          )}
        </div>
      </Grid>
    </Grid.Container>
  );
};
