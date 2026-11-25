// ============================================================================
//  Control del periodo de prueba gratuito.
//  ----------------------------------------------------------------------------
//  Se controla con la variable de entorno NEXT_PUBLIC_FREE_TRIAL_ENABLED:
//
//    NEXT_PUBLIC_FREE_TRIAL_ENABLED=true (o 1)  -> hay prueba gratuita (15 días)
//    cualquier otra cosa, o sin poner           -> NO hay prueba; sin plan, a /plans
//
//  APAGADA SI FALTA, Y ESO ES UN CAMBIO
//  ------------------------------------
//  Antes la condición era `!== "false"`, así que la prueba estaba ACTIVA salvo
//  que alguien escribiera exactamente «false». Una bandera que regala 15 días
//  de producto por olvidarse de ponerla es un fallo esperando a pasar: no
//  avisa, no rompe nada y solo se nota al mirar los ingresos. Ahora se
//  comporta como las demás banderas del proyecto, que están apagadas si
//  faltan, y hay que encenderla a propósito.
//
//  Se acepta «1» además de «true» porque el resto de banderas usan «1», y
//  porque si producción ya tenía «true» puesto, sigue valiendo igual.
// ============================================================================

// ¿Está activo el periodo de prueba?
const CRUDO = (process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED || "").trim().toLowerCase();
export const FREE_TRIAL_ENABLED = CRUDO === "true" || CRUDO === "1";

// Duración de la prueba en días (solo aplica si está activa).
export const FREE_TRIAL_DAYS = 15;

// Devuelve true si el usuario todavía tiene acceso por estar en prueba.
// Si la prueba está apagada, siempre devuelve false.
export const isWithinTrial = (daysLeft: number): boolean => {
  if (!FREE_TRIAL_ENABLED) return false;
  return daysLeft >= 0 && daysLeft < FREE_TRIAL_DAYS + 1;
};
