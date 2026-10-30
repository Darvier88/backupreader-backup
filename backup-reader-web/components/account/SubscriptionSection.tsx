import React, { useContext, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { Button, Loading } from "@nextui-org/react";

import { FirestoreContext } from "../../context";
import { FirebaseAuth } from "../../config/firebase";
import { planCancelado } from "../../config/acceso";

/**
 * Bloque de suscripción para AccountScreen.
 *
 * Cancelar NO corta el acceso al momento: Stripe deja de cobrar al final del
 * periodo ya pagado y hasta entonces el plan sigue valiendo. Lo que se guarda
 * en Firestore es esa fecha (`user.planCancelAt`); quien la hace cumplir es
 * `tieneAcceso` en config/acceso.ts.
 *
 * El token de sesión va en la petición porque el endpoint no se fía del correo
 * que le manden: lo verifica contra Firebase. Si no, bastaría conocer la
 * dirección de alguien para cancelarle la suscripción.
 */
export const SubscriptionSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, subscription, getPlans, updatePlanCancelAt } =
    useContext(FirestoreContext);

  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [exito, setExito] = useState("");

  /* La lista de planes es solo para poner el nombre; si no ha llegado, se
     enseña el bloque igual, sin nombre. */
  useEffect(() => {
    if (!subscription || subscription.length === 0) getPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = subscription?.find((p: any) => p.id === user?.plan);

  /* Tres estados, no dos. `user.plan` sigue puesto después de cancelar, así
     que sin distinguir "cancelado pero vigente" de "ya vencido" la pantalla
     seguiría diciendo "se renueva cada mes" a quien ya no tiene nada. */
  const cancelado = planCancelado(user);
  const vencido = Boolean(
    user?.plan && user?.planCancelAt && Date.now() >= (user.planCancelAt as number)
  );

  const fecha = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language || "es", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const llamar = async (accion: "cancelar" | "reactivar") => {
    setAviso("");
    setExito("");

    const actual = FirebaseAuth.currentUser;
    if (!actual || !user?.uid) {
      setAviso(t("Tu sesión ha caducado. Vuelve a iniciar sesión."));
      return;
    }

    setOcupado(true);
    try {
      /* `true` fuerza un token recién emitido: uno caducado lo rechazaría el
         endpoint y el usuario vería un fallo que no es suyo. */
      const idToken = await actual.getIdToken(true);
      const r = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, accion }),
      });
      const data = await r.json();

      if (!r.ok || !data?.ok) {
        setAviso(t("No se pudo completar la operación. Inténtalo de nuevo."));
        return;
      }

      if (data.sinSuscripcion) {
        setAviso(
          t("No encontramos una suscripción activa en Stripe para tu correo. Escríbenos a info@backupreader.com y lo revisamos.")
        );
        return;
      }

      if (accion === "cancelar") {
        await updatePlanCancelAt(user.uid, data.activoHasta ?? Date.now());
        setExito(t("Suscripción cancelada. No se te volverá a cobrar."));
      } else {
        await updatePlanCancelAt(user.uid, null);
        setExito(t("Suscripción reactivada."));
      }
    } catch (err) {
      console.error("Error al cambiar la suscripción:", err);
      setAviso(t("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  };

  // --- Sin plan -------------------------------------------------------------

  if (!user?.plan) {
    return (
      <Box sx={{ marginTop: 3 }}>
        <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
          {t("Suscripción")}
        </Typography>
        <Typography
          fontFamily={"Open Sans"}
          fontSize={15}
          style={{ color: "#3C3C3C", margin: "8px 0" }}
        >
          {t("No tienes una suscripción activa.")}
        </Typography>
        <Button auto bordered onPress={() => router.push("/plans")}>
          {t("Ver planes")}
        </Button>
      </Box>
    );
  }

  // --- Con plan -------------------------------------------------------------

  return (
    <Box sx={{ marginTop: 3 }}>
      <Typography fontFamily={"PT Serif"} fontSize={18} style={{ color: "#3C3C3C" }}>
        {t("Suscripción")}
      </Typography>

      <Typography
        fontFamily={"Open Sans"}
        fontSize={15}
        style={{ color: "#3C3C3C", margin: "8px 0 2px" }}
      >
        {plan?.details?.name
          ? `${t("Plan")} ${plan.details.name}`
          : t("Tienes un plan activo.")}
      </Typography>

      {cancelado && user.planCancelAt ? (
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#6B6B6B", margin: "0 0 12px" }}
        >
          {t("Cancelada. Mantienes el acceso hasta el")} {fecha(user.planCancelAt)}.
        </Typography>
      ) : vencido && user.planCancelAt ? (
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#6B6B6B", margin: "0 0 12px" }}
        >
          {t("Tu suscripción terminó el")} {fecha(user.planCancelAt)}.
        </Typography>
      ) : (
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#6B6B6B", margin: "0 0 12px" }}
        >
          {t("Se renueva cada mes. Puedes cancelar cuando quieras.")}
        </Typography>
      )}

      {aviso && (
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#B23B3B", marginBottom: 8 }}
        >
          {aviso}
        </Typography>
      )}
      {exito && (
        <Typography
          fontFamily={"Open Sans"}
          fontSize={14}
          style={{ color: "#2E7D32", marginBottom: 8 }}
        >
          {exito}
        </Typography>
      )}

      {vencido ? (
        /* Ya no hay nada que reactivar en Stripe: la suscripción se cerró al
           llegar la fecha. Lo honesto es mandarle a contratar de nuevo. */
        <Button auto bordered onPress={() => router.push("/plans")}>
          {t("Ver planes")}
        </Button>
      ) : cancelado ? (
        <Button auto bordered onPress={() => llamar("reactivar")} disabled={ocupado}>
          {ocupado ? (
            <Loading type="points" color="currentColor" size="sm" />
          ) : (
            t("Reactivar suscripción")
          )}
        </Button>
      ) : confirmando ? (
        /* Paso de confirmación en la propia página: cancelar es algo que no se
           debería disparar con un solo clic despistado. */
        <Box>
          <Typography
            fontFamily={"Open Sans"}
            fontSize={14}
            style={{ color: "#3C3C3C", marginBottom: 8 }}
          >
            {t("Dejaremos de cobrarte, y mantendrás el acceso hasta el final del periodo que ya pagaste. Tus chats no se borran.")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button auto color="error" onPress={() => llamar("cancelar")} disabled={ocupado}>
              {ocupado ? (
                <Loading type="points" color="currentColor" size="sm" />
              ) : (
                t("Sí, cancelar")
              )}
            </Button>
            <Button auto light onPress={() => setConfirmando(false)} disabled={ocupado}>
              {t("Ahora no")}
            </Button>
          </Box>
        </Box>
      ) : (
        <Button auto bordered color="error" onPress={() => setConfirmando(true)}>
          {t("Cancelar suscripción")}
        </Button>
      )}
    </Box>
  );
};
