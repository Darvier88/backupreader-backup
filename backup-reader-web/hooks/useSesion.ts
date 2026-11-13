import { useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { FirebaseAuth } from "../config/firebase";
import { FirestoreContext } from "../context";
import { tieneAcceso } from "../config/acceso";

/**
 * ¿Hay sesión iniciada, y puede entrar a sus chats?
 *
 * `haySesion` sale de Firebase Auth directamente, no del documento de
 * Firestore: el documento llega un momento después y, mientras tanto, el logo
 * volvería a ser un enlace durante un parpadeo.
 *
 * `puedeVerChats` es la misma regla que usa LoadingComponent para dejar pasar
 * al panel (plan vigente o prueba). Sin ella, «Mis chats» llevaría a /dashboard
 * y de ahí te devolvería a /plans.
 */
export function useSesion(): { haySesion: boolean; puedeVerChats: boolean } {
  const { user } = useContext(FirestoreContext);
  const [cuenta, setCuenta] = useState<User | null>(() =>
    typeof window !== "undefined" ? FirebaseAuth.currentUser : null
  );

  useEffect(() => onAuthStateChanged(FirebaseAuth, setCuenta), []);

  const creada = cuenta?.metadata?.creationTime;
  const dias = creada ? Math.floor((Date.now() - new Date(creada).getTime()) / 86400000) : 0;

  return {
    haySesion: Boolean(cuenta),
    puedeVerChats: Boolean(cuenta && user && tieneAcceso(user, dias)),
  };
}
