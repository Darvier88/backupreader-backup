import { NextPage } from "next";

import { EntradaScreen } from "../components/screens/EntradaScreen";

/**
 * Entrar o crear cuenta.
 *
 * `/login` y `/auth` llevan a la misma pantalla desde la ronda 4: el mismo
 * botón sirve para las dos cosas, así que separarlas obligaba al usuario a
 * decidir antes de empezar si ya tenía cuenta, que es justo lo que muchos no
 * saben contestar. Las dos rutas se conservan porque hay enlaces repartidos
 * por la aplicación y por correos ya enviados.
 */
export const login: NextPage = () => {
  return <EntradaScreen />;
};

export default login;
