import { FC, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";

import { VaultContext } from "../../context/VaultContext";
import { PantallaCrearClave, creacionEnCurso, marcarCreacionEnCurso } from "./PantallaCrearClave";
import { PantallaDesbloqueo, yaSeOmitio } from "./PantallaDesbloqueo";

/**
 * El paso de bóveda que toque, por encima de todo (4c, 5a, 5b y 5c).
 *
 * POR QUÉ VIVE EN EL LAYOUT Y NO DENTRO DEL PANEL
 * -----------------------------------------------
 * Estaba dentro de `DashboardMain`, que se dibuja dentro de
 * `LoadingComponent`. Ese componente intercambia TODO su contenido por una
 * rueda cada vez que se enciende `loading`, y lo encienden cinco sitios
 * distintos que no saben nada de la bóveda. Cada encendido desmonta el árbol
 * entero y, al volver, el paso empezaba de cero.
 *
 * Eso no era un parpadeo: crear la bóveda enciende `loading`, así que el
 * código de recuperación —que se genera una sola vez y sin el cual unos chats
 * olvidados no se recuperan jamás— se generaba y desaparecía en el mismo
 * instante, antes de que nadie pudiera leerlo. Aquí arriba, fuera del
 * intercambio, el paso sobrevive a los encendidos de `loading`.
 *
 * Solo en el panel: en el resto de páginas (planes, pago, ayuda, legales) no
 * hay nada cifrado que abrir, y tapar la pantalla de pago con una petición de
 * contraseña sería absurdo.
 */
export const PasoBoveda: FC = () => {
  const router = useRouter();
  const { status } = useContext(VaultContext);

  /* Arranca en true para no enseñar el paso durante el parpadeo inicial, en el
     que `status` todavía es "checking" y aún no se sabe si hace falta. */
  const [omitido, setOmitido] = useState(true);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    setOmitido(yaSeOmitio());
    /* La barra de 4d pide volver al paso desde otra rama del árbol, así que
       avisa con un evento en vez de con un prop que tendría que atravesar
       media aplicación. */
    const volver = () => setOmitido(false);
    window.addEventListener("br:revisar-boveda", volver);
    return () => window.removeEventListener("br:revisar-boveda", volver);
  }, []);

  useEffect(() => {
    if (status === "none") marcarCreacionEnCurso();
    setCreando(status === "none" || creacionEnCurso());
  }, [status]);

  if (router.pathname !== "/dashboard") return null;

  if (creando) {
    return <PantallaCrearClave onListo={() => setCreando(false)} />;
  }

  if (status === "locked" && !omitido) {
    return <PantallaDesbloqueo onOmitir={() => setOmitido(true)} />;
  }

  return null;
};

export default PasoBoveda;
