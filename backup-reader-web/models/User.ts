export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan?: string | null;
  /**
   * Milisegundos. Si está puesta, el plan está cancelado y deja de dar acceso
   * en esa fecha (el final del periodo que el usuario ya pagó). null o ausente
   * = suscripción corriente.
   */
  planCancelAt?: number | null;
  /** Plan regalado a mano (herramientas/dar-plan): la sincronización con
   *  Stripe no se lo quita salvo que haya una suscripción con acceso. */
  planManual?: boolean | null;
  firestoreId?: string;
  storageSize?: number | null;
};
