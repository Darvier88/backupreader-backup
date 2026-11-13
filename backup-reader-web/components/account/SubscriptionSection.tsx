import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { Loading } from "@nextui-org/react";
import { SeccionCuenta } from "./SeccionCuenta";

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

  const titulo = { fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink-900)" } as const;
  const detalle = { fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--slate-700)" } as const;

  if (!user?.plan) {
    return (
      <SeccionCuenta etiqueta={t("Suscripción")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={detalle}>{t("No tienes una suscripción activa.")}</span>
          <button type="button" className="br-btn br-btn-ghost br-btn-sm" onClick={() => router.push("/plans")}>
            {t("Ver planes")}
          </button>
        </div>
      </SeccionCuenta>
    );
  }

  // --- Con plan -------------------------------------------------------------

  /* «Cancelar suscripción» en arcilla y como enlace, no como botón rojo
     (12d): es una salida, no la acción principal de la página. */
  const accion = vencido ? (
    /* Ya no hay nada que reactivar en Stripe: la suscripción se cerró al
       llegar la fecha. Lo honesto es mandarle a contratar de nuevo. */
    <button type="button" className="br-btn br-btn-ghost br-btn-sm" onClick={() => router.push("/plans")}>
      {t("Ver planes")}
    </button>
  ) : cancelado ? (
    <button type="button" className="br-btn br-btn-ghost br-btn-sm" onClick={() => llamar("reactivar")} disabled={ocupado}>
      {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Reactivar suscripción")}
    </button>
  ) : confirmando ? null : (
    <button type="button" className="br-enlace-arcilla" onClick={() => setConfirmando(true)}>
      {t("Cancelar suscripción")}
    </button>
  );

  return (
    <SeccionCuenta etiqueta={t("Suscripción")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={titulo}>
            {plan?.details?.name ? `${t("Plan")} ${plan.details.name}` : t("Tienes un plan activo.")}
          </span>
          <span style={detalle}>
            {cancelado && user.planCancelAt
              ? `${t("Cancelada. Mantienes el acceso hasta el")} ${fecha(user.planCancelAt)}.`
              : vencido && user.planCancelAt
              ? `${t("Tu suscripción terminó el")} ${fecha(user.planCancelAt)}.`
              : t("Se renueva cada mes. Puedes cancelar cuando quieras.")}
          </span>
        </div>
        {accion}
      </div>

      {aviso && <span style={{ ...detalle, color: "var(--clay-600)" }}>{aviso}</span>}
      {exito && <span style={{ ...detalle, color: "var(--brass-600)" }}>{exito}</span>}

      {confirmando && (
        /* Paso de confirmación en la propia página: cancelar es algo que no se
           debería disparar con un solo clic despistado. */
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--paper-100)" }}>
          <span style={{ ...detalle, color: "var(--ink-900)" }}>
            {t("Dejaremos de cobrarte, y mantendrás el acceso hasta el final del periodo que ya pagaste. Tus chats no se borran.")}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="br-btn br-btn-sm"
              style={{ background: "var(--clay-600)", color: "var(--paper-50)", border: 0 }}
              onClick={() => llamar("cancelar")}
              disabled={ocupado}
            >
              {ocupado ? <Loading type="points" color="currentColor" size="sm" /> : t("Sí, cancelar")}
            </button>
            <button type="button" className="br-btn br-btn-ghost br-btn-sm" onClick={() => setConfirmando(false)} disabled={ocupado}>
              {t("Ahora no")}
            </button>
          </div>
        </div>
      )}
    </SeccionCuenta>
  );
};
