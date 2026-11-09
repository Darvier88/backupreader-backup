import { isWithinTrial } from "./trial";

type UsuarioConPlan = {
  plan?: string | null;
  /** Milisegundos. Fecha hasta la que sigue valiendo un plan ya cancelado. */
  planCancelAt?: number | null;
} | null;

/**
 * ¿Puede este usuario entrar al área privada?
 *
 * Antes era `user.plan || isWithinTrial(daysLeft)` escrito a mano en
 * LoadingComponent. Se extrae aquí porque ahora hay un tercer caso: un plan
 * cancelado que todavía no ha expirado.
 *
 * Al cancelar NO se borra `user.plan`: el usuario ya pagó el periodo en curso y
 * se le deja terminarlo. Lo que se guarda es `planCancelAt`, la fecha en que
 * Stripe deja de cobrar, y a partir de ahí el plan deja de dar acceso.
 *
 * Quién apaga el acceso al llegar esa fecha: esta función, al comparar con el
 * reloj del navegador. No hay webhook de Stripe que limpie `user.plan`, así que
 * sin esta comprobación una suscripción cancelada daría acceso para siempre.
 * Es una defensa de cliente, no de servidor: lo que de verdad protege los
 * archivos son las reglas de Firebase.
 */
export const tieneAcceso = (user: UsuarioConPlan, daysLeft: number): boolean => {
  if (user?.plan) {
    const hasta = user.planCancelAt;
    if (!hasta) return true;
    if (Date.now() < hasta) return true;
    /* Plan cancelado y vencido: ya no vale. Se sigue evaluando la prueba por
       si acaso, en lugar de devolver false directamente. */
  }
  return isWithinTrial(daysLeft);
};

/** ¿Hay un plan cancelado que aún no ha expirado? */
export const planCancelado = (user: UsuarioConPlan): boolean =>
  Boolean(user?.plan && user?.planCancelAt && Date.now() < (user.planCancelAt as number));
