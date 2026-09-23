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
    color: "#0F52BA",
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
              fontFamily={"Open Sans"}
              style={{ color: "#0F52BA", textAlign: "center" }}
            >
              Privacy Policy and Terms of Service.
            </Typography>
          ) : (
            <Typography
              fontSize={12}
              fontFamily={"Open Sans"}
              style={{ color: "#3C3C3C", textAlign: "center" }}
            >
              <Button
                style={{ textTransform: "none" }}
                onClick={() => router.push("/termsConditions")}
              >
                <Typography
                  fontSize={12}
                  fontFamily={"Open Sans"}
                  style={{ color: "#0F52BA" }}
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
                  fontFamily={"Open Sans"}
                  style={{ color: "#0F52BA" }}
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
