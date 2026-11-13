import { FC } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { useSesion } from "../../hooks/useSesion";

/**
 * «← Mis chats», encima del título de las páginas sueltas (Mi cuenta, Ayuda,
 * legales). Con la sesión iniciada el logo ya no lleva a ninguna parte, así
 * que esta es la salida.
 *
 * Solo sale si hay sesión Y puede ver sus chats: sin plan, /dashboard lo
 * devolvería a /plans y el enlace sería una trampa.
 */
export const VolverAMisChats: FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { puedeVerChats } = useSesion();
  if (!puedeVerChats) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard")}
      className="br-volver-chats"
      style={style}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {t("Mis chats")}
    </button>
  );
};
