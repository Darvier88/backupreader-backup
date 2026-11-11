import { NextPage } from "next";

import { PlanActivoScreen } from "../components/screens/PlanActivoScreen";

/**
 * Confirmación del pago (pantalla 6b).
 *
 * Se llega aquí al terminar el cobro, antes del panel. Antes se iba directo a
 * `/dashboard` y el cobro desaparecía sin acuse.
 */
export const planActivo: NextPage = () => {
  return <PlanActivoScreen />;
};

export default planActivo;
