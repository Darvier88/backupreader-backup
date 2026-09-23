// ============================================================================
//  Control del periodo de prueba gratuito.
//  ----------------------------------------------------------------------------
//  Se controla con la variable de entorno NEXT_PUBLIC_FREE_TRIAL_ENABLED:
//
//    NEXT_PUBLIC_FREE_TRIAL_ENABLED=true   -> hay prueba gratuita (15 días)
//    NEXT_PUBLIC_FREE_TRIAL_ENABLED=false  -> NO hay prueba; sin plan => /plans
//
//  Si la variable no está definida, por defecto la prueba queda ACTIVA
//  (comportamiento histórico del proyecto).
// ============================================================================

// ¿Está activo el periodo de prueba?
export const FREE_TRIAL_ENABLED =
  process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED !== "false";

// Duración de la prueba en días (solo aplica si está activa).
export const FREE_TRIAL_DAYS = 15;

// Devuelve true si el usuario todavía tiene acceso por estar en prueba.
// Si la prueba está apagada, siempre devuelve false.
export const isWithinTrial = (daysLeft: number): boolean => {
  if (!FREE_TRIAL_ENABLED) return false;
  return daysLeft >= 0 && daysLeft < FREE_TRIAL_DAYS + 1;
};
