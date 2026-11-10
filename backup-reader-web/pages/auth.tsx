import { NextPage } from "next";

import { EntradaScreen } from "../components/screens/EntradaScreen";

/** Misma pantalla que `/login`: ver la nota de allí. */
export const auth: NextPage = () => {
  return <EntradaScreen />;
};

export default auth;
