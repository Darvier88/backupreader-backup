/**
 * ¿Quien llama es super admin?
 *
 * Existe para que la pantalla no tenga que adivinarlo. La lista de admins vive
 * en una variable de entorno del servidor y ahí se queda: si se expusiera con
 * `NEXT_PUBLIC_` entraría en el bundle y cualquiera podría leer qué correos
 * administran el sitio.
 *
 * No concede nada. Cada endpoint de administración vuelve a comprobar el
 * permiso por su cuenta, así que falsear la respuesta de esto en el navegador
 * solo pinta una tabla vacía: el listado y el borrado responden 403 igual.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { soloSuperAdmin } from "../../../lib/admin-servidor";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const quien = await soloSuperAdmin(req, res);
  if (!quien) return;

  return res.status(200).json({ ok: true, esAdmin: true, correo: quien.email });
}
