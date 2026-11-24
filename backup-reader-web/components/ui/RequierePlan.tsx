import { FC, ReactNode, useEffect } from "react";
import { useRouter } from "next/router";

import { useSesion } from "../../hooks/useSesion";

/**
 * Envuelve las páginas que solo se ven con plan vigente (/dashboard,
 * /initialDashboard, /backups/[id]).
 *
 * Es una segunda comprobación, en la propia página, además de la de
 * LoadingComponent: si por lo que sea aquella no corre (una navegación que no
 * la dispara, un cambio futuro en el Layout), esta sí. Sin plan no se pinta
 * nada y se manda a /plans. Mientras el documento del usuario no ha llegado
 * tampoco se pinta: no se sabe todavía si tiene plan.
 */
export const RequierePlan: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { haySesion, puedeVerChats, listo } = useSesion();
  const bloquear = haySesion && listo && !puedeVerChats;

  useEffect(() => {
    if (bloquear) router.replace("/plans");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloquear]);

  if (haySesion && (!listo || !puedeVerChats)) return null;
  return <>{children}</>;
};
