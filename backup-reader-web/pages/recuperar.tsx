import { NextPage } from "next";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { RECUPERAR_CONTRASENA } from "../lib/funciones-activas";

import { RecuperarScreen } from "../components/screens/RecuperarScreen";

/**
 * Recuperar la contraseña de la cuenta (pantallas 5d y 5e).
 *
 * No es la clave de cifrado: esa no se puede restablecer por correo, porque el
 * servidor nunca la tuvo. Para aquella está el código de recuperación, en el
 * paso de desbloqueo.
 */
export const recuperar: NextPage = () => {
  /* Recuperar contraseña está apagado (ver `lib/funciones-activas.ts`).
     Se va al inicio en vez de enseñar un 404: una pantalla de error hace
     pensar que algo se ha roto, y esto no está roto, está desactivado.
     La redirección va en un efecto y no en `getServerSideProps` para que esta
     página siga siendo estática y no cueste un render de servidor por visita.
     Mientras tanto no se pinta nada: así no aparece el formulario durante un
     instante antes de irse. */
  const router = useRouter();
  useEffect(() => {
    if (!RECUPERAR_CONTRASENA) router.replace("/");
  }, [router]);
  if (!RECUPERAR_CONTRASENA) return null;

  return <RecuperarScreen />;
};

export default recuperar;
