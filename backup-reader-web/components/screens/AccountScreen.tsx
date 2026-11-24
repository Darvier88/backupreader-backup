import { FC, useContext, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Theme, useMediaQuery } from "@mui/material";

import { AuthContext, FirestoreContext } from "../../context";
import { StorageContext } from "../../context/StorageContext";
import { VaultPasswordSection } from "../vault";
import { SubscriptionSection } from "../account/SubscriptionSection";
import { SeccionCuenta } from "../account/SeccionCuenta";
import { ConversationsDrawer } from "../drawers";
import { useSesion } from "../../hooks/useSesion";
import { useEspacioOcupado } from "../../hooks/useEspacioOcupado";
import { tamanoLegible } from "../../lib/tamano-legible";
import { pedirSincronizacion } from "../../lib/pedir-sincronizacion";

/** `t()` puede devolver null según sus tipos; esto lo deja en string. */
const enTexto = (v: unknown): string => (v as string | null | undefined) ?? "";

const flecha = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/**
 * Mi cuenta (12d escritorio, 12e móvil).
 *
 * En escritorio vive dentro de la app: el panel lateral sigue a la izquierda,
 * con «Inicio», el buscador y los chats a un clic, y arriba unas migas
 * «‹ Inicio / Mi cuenta». Esc también vuelve. En el móvil, una barra de 44 px
 * con «‹ Inicio» siempre en el mismo sitio. La cabecera con Ayuda / Cerrar
 * sesión ya no se pinta aquí (ver Layout): repetía lo que hay en el panel.
 */
export const AccountScreen: FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, subscription, getPlans, getUser } = useContext(FirestoreContext);
  const { getFile, cerrarChat } = useContext(StorageContext);
  const { logOut } = useContext(AuthContext);
  const espacio = useEspacioOcupado();
  const phone = useMediaQuery(({ breakpoints }: Theme) => breakpoints.down("sm"));

  useEffect(() => {
    if (!subscription || subscription.length === 0) getPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Al abrir Mi cuenta se pone el plan al día con Stripe: cubre cobros
     fallidos, cancelaciones hechas desde Stripe y cuentas que se quedaron
     mal antes del webhook (p. ej. con la fecha de fin de un plan viejo tras
     volver a contratar). Sin hacer esperar a nadie: si cambió, se relee. */
  useEffect(() => {
    if (!user?.uid) return;
    let vigente = true;
    void pedirSincronizacion().then((r) => {
      if (vigente && r.tipo === "servidor" && r.cambiado) getUser(user.uid);
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const { puedeVerChats } = useSesion();
  /* Sin plan, «Inicio» lleva a los planes y no al panel (que le mandaría
     allí de todas formas). */
  const volverAlInicio = () => {
    cerrarChat();
    router.push(puedeVerChats ? "/dashboard" : "/plans");
  };

  /* Esc vuelve al inicio, salvo que se esté escribiendo en un campo (ahí Esc
     es de ese campo) o haya un diálogo abierto encima. */
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.querySelector("[role='dialog'], .cb-overlay")) return;
      volverAlInicio();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contenido = (
    <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      {!phone && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 34, letterSpacing: "-0.02em", color: "var(--ink-900)" }}>
            {t("Mi cuenta")}
          </h1>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--slate-700)" }}>{user?.email}</span>
        </div>
      )}

      {/* Cuánto ocupan los chats guardados. Mientras carga no se enseña
          nada: mejor un hueco un instante que un «0 B» que no es verdad.
          Sin barra ni cuota: los planes no traen un total de GB y no hay
          un límite real por plan que enseñar. */}
      <SeccionCuenta etiqueta={t("Almacenamiento")}>
        <div style={{ minHeight: 22, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          {espacio && (
            <>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink-900)" }}>
                {t("Tus chats ocupan")} <strong>{tamanoLegible(espacio.bytes, i18n.language)}</strong>
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-500)", textTransform: "uppercase" }}>
                {espacio.chats === 1 ? t("1 chat") : enTexto(t("{{n}} chats", { n: espacio.chats }))}
              </span>
            </>
          )}
        </div>
      </SeccionCuenta>

      <SubscriptionSection />

      {/* Clave de cifrado y código de recuperación. */}
      <VaultPasswordSection />

      <SeccionCuenta etiqueta={t("Sesión")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--slate-700)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.email}
          </span>
          <button
            type="button"
            onClick={logOut}
            style={{ padding: "8px 0", border: 0, background: "transparent", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)", cursor: "pointer" }}
          >
            {t("Salir")}
          </button>
        </div>
      </SeccionCuenta>
    </div>
  );

  if (phone) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--paper-50)" }}>
        <div className="br-barra-cuenta">
          <button type="button" className="br-volver-inicio" onClick={volverAlInicio}>
            {flecha}
            {t("Inicio")}
          </button>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "var(--ink-900)" }}>
            {t("Mi cuenta")}
          </span>
          <span />
        </div>
        <div style={{ padding: "4px 20px 32px" }}>{contenido}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--paper-50)", maxWidth: 1360, margin: "0 auto", width: "100%" }}>
      {/* Sin plan vigente no hay panel de chats: Mi cuenta se sigue pudiendo
          ver (para contratar, ver la suscripción o salir), pero no es una
          puerta trasera a los chats. */}
      {puedeVerChats && (
        <aside style={{ width: 300, flexShrink: 0, alignSelf: "stretch", background: "var(--paper-100)", borderRight: "1px solid var(--border)" }}>
          <ConversationsDrawer
            selected=""
            onPress={(fullPath, nombre) => {
              getFile(fullPath, nombre);
              router.push("/dashboard");
            }}
          />
        </aside>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <nav className="br-migas" aria-label={enTexto(t("Migas"))}>
          <button type="button" className="br-volver-inicio" onClick={volverAlInicio}>
            {flecha}
            {t("Inicio")}
          </button>
          <span style={{ color: "var(--slate-400)" }}>/</span>
          <span style={{ color: "var(--slate-700)" }}>{t("Mi cuenta")}</span>
        </nav>
        <div style={{ padding: "32px 40px 48px" }}>{contenido}</div>
      </div>
    </div>
  );
};
