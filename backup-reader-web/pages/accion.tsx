import { NextPage } from "next";
import Head from "next/head";

import { AccionCorreoScreen } from "../components/screens/AccionCorreoScreen";

/**
 * Los enlaces de los correos de Firebase (pantalla 5f).
 *
 * Esta es la dirección que hay que poner en la consola de Firebase, en
 * Authentication → Plantillas → el lápiz → «personalizar URL de acción»:
 *
 *   https://TU-DOMINIO/accion
 *
 * Ese ajuste es uno solo para las cuatro plantillas de correo, así que desde
 * el momento en que se cambie, por aquí entran también los enlaces de
 * verificar el correo y los de deshacer un cambio de dirección, no solo los de
 * contraseña. La pantalla atiende los tres.
 *
 * ORDEN AL DESPLEGAR: esta página tiene que estar en producción ANTES de
 * tocar el ajuste. Al revés, los enlaces que ya estén en bandejas de entrada
 * apuntarían a una página que todavía no existe.
 */
export const accion: NextPage = () => {
  return (
    <>
      <Head>
        {/* Que no se indexe: son URLs de un solo uso con un código dentro. */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AccionCorreoScreen />
    </>
  );
};

export default accion;
