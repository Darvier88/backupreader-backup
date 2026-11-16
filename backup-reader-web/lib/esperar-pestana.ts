/**
 * Espera a que la pestaña vuelva a estar a la vista y con conexión.
 *
 * Lo usan los reintentos de subida: no tiene sentido reintentar con la
 * pestaña en segundo plano (el navegador la tiene congelada o muy frenada)
 * ni sin red. Si ya se cumple, resuelve al momento.
 */
export function hastaQueSePuedaSeguir(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const listo = () => document.visibilityState === "visible" && navigator.onLine !== false;
  if (listo()) return Promise.resolve();
  return new Promise((resolve) => {
    const mirar = () => {
      if (!listo()) return;
      document.removeEventListener("visibilitychange", mirar);
      window.removeEventListener("online", mirar);
      resolve();
    };
    document.addEventListener("visibilitychange", mirar);
    window.addEventListener("online", mirar);
  });
}

/**
 * Mantiene la pantalla encendida mientras dure algo largo (Screen Wake Lock).
 * El navegador suelta el bloqueo al ocultar la pestaña, así que se vuelve a
 * pedir al volver. Devuelve la función para soltarlo. Donde no existe la API
 * no hace nada.
 */
export function mantenerPantallaEncendida(): () => void {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return () => {};
  let bloqueo: any = null;
  let activo = true;
  const pedir = async () => {
    if (!activo || document.visibilityState !== "visible") return;
    try {
      bloqueo = await (navigator as any).wakeLock.request("screen");
    } catch {
      /* Sin permiso o batería baja: se sigue sin él. */
    }
  };
  const alVolver = () => {
    if (document.visibilityState === "visible") void pedir();
  };
  void pedir();
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    activo = false;
    document.removeEventListener("visibilitychange", alVolver);
    try {
      void bloqueo?.release();
    } catch {
      /* ya estaba suelto */
    }
  };
}
