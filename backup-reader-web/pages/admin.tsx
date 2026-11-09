import { NextPage } from "next";
import Head from "next/head";
import { AdminScreen } from "../components/admin/AdminScreen";

/**
 * Panel de administración.
 *
 * `noindex` para que no acabe en Google. No protege nada —el permiso lo
 * comprueban los endpoints— pero una ruta de administración indexada es una
 * invitación a que la prueben.
 */
const Admin: NextPage = () => {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Administración · Backup Reader</title>
      </Head>
      <AdminScreen />
    </>
  );
};

export default Admin;
