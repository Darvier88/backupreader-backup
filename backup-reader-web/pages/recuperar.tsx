import { NextPage } from "next";

import { RecuperarScreen } from "../components/screens/RecuperarScreen";

/**
 * Recuperar la contraseña de la cuenta (pantallas 5d y 5e).
 *
 * No es la clave de cifrado: esa no se puede restablecer por correo, porque el
 * servidor nunca la tuvo. Para aquella está el código de recuperación, en el
 * paso de desbloqueo.
 */
export const recuperar: NextPage = () => {
  return <RecuperarScreen />;
};

export default recuperar;
