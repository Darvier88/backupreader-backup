/**
 * Borrar un usuario y todo lo suyo.
 *
 * Es la operación más destructiva de la aplicación y no se puede deshacer: los
 * chats están cifrados con una DEK que solo existe envuelta en
 * `vaults/{uid}`, así que en cuanto ese documento se va, los blobs de Storage
 * son ruido para siempre, incluso teniendo el bucket delante. No hay copia de
 * seguridad que rescate nada.
 *
 * EL ORDEN IMPORTA
 * ----------------
 * Los pasos van del más peligroso de dejar a medias al menos peligroso:
 *
 *  1. Stripe. Primero, siempre. Lo peor que puede pasar en un borrado a
 *     medias es que la cuenta desaparezca y la suscripción siga cobrando cada
 *     mes a alguien que ya no puede entrar a cancelarla. Cortar el cobro
 *     antes de tocar nada deja ese caso fuera.
 *  2. Storage. El bulto: puede ser mucho, y es lo que más tarda.
 *  3. Firestore: los metadatos de los chats, la bóveda, el estado y el perfil.
 *  4. Auth, al final.
 *
 * Auth va último a propósito. Mientras la cuenta exista en Auth, el usuario
 * sigue apareciendo en el listado del panel y el borrado se puede volver a
 * lanzar para terminar lo que faltó. Si se borrara primero, un fallo a mitad
 * dejaría datos sin dueño que ya no salen en ninguna lista: nadie se enteraría
 * de que están ahí, y seguirían ocupando espacio y contando como datos
 * personales guardados.
 *
 * Por eso mismo cada paso tolera que lo suyo ya no esté, y la operación se
 * puede repetir tantas veces como haga falta sin romper nada.
 *
 * SI STORAGE NO TERMINA
 * ---------------------
 * Una cuenta con muchos chats puede tener miles de objetos, y una función de
 * Vercel tiene unos segundos. Si se agota el presupuesto de trabajo, este
 * endpoint NO borra la cuenta de Auth: responde `pendiente: true` diciendo
 * cuántos archivos quedan, y el admin lo vuelve a lanzar. Es preferible a
 * borrar la cuenta y dejar el bucket a medias sin que nadie lo sepa.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  anotarEnAuditoria,
  authAdmin,
  esSuperAdmin,
  soloSuperAdmin,
} from "../../../lib/admin-servidor";
import {
  borrarFirestore,
  borrarStorage,
  confirmacionValida,
  type PasoFirestore,
  type PasoStorage,
} from "../../../lib/admin-borrado";
import { cortarStripe, stripeConfigurado, type PasoStripe } from "../../../lib/admin-stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const quien = await soloSuperAdmin(req, res);
  if (!quien) return;

  const { uid, confirmacion, reembolsar } = req.body ?? {};

  if (typeof uid !== "string" || !uid) {
    return res.status(400).json({ ok: false, error: "sin-uid" });
  }

  /* --- Guardas antes de tocar nada --- */

  /* Borrarse a uno mismo deja el panel sin administrador y no se puede
     deshacer desde la propia aplicación: habría que volver a crear la cuenta
     con el mismo correo y rehacer la variable de entorno. Se niega. */
  if (uid === quien.uid) {
    return res.status(400).json({ ok: false, error: "no-puedes-borrarte" });
  }

  let cuenta;
  try {
    cuenta = await authAdmin().getUser(uid);
  } catch (error: any) {
    if (error?.code === "auth/user-not-found") {
      return res.status(404).json({ ok: false, error: "no-existe" });
    }
    console.error("Administración: fallo al leer la cuenta", uid, error);
    return res.status(500).json({ ok: false, error: "fallo-al-leer" });
  }

  const correo = cuenta.email ?? "";

  /* Un admin no borra a otro admin desde aquí. Quitarle primero el correo de
     la variable de entorno es un paso deliberado, y obliga a pensarlo dos
     veces antes de dejar el panel con un administrador menos. */
  if (esSuperAdmin(uid, correo)) {
    return res.status(400).json({ ok: false, error: "es-admin" });
  }

  /* La confirmación es el correo del usuario escrito a mano, no un sí/no. Un
     botón de confirmar no distingue entre "quiero borrar a este" y "me
     equivoqué de fila", que con una tabla de correos parecidos es el error
     fácil de cometer. Escribir el correo obliga a mirar a quién se borra.
     Sin correo —una cuenta solo de teléfono— se pide el uid. */
  const { vale, esperado } = confirmacionValida(confirmacion, correo, uid);
  if (!vale) {
    return res
      .status(400)
      .json({ ok: false, error: "confirmacion-no-coincide", esperado });
  }

  const devolverDinero = reembolsar === true;

  await anotarEnAuditoria("borrado-de-usuario:empieza", {
    porUid: quien.uid,
    porCorreo: quien.email,
    uid,
    correo,
    reembolsar: devolverDinero,
  });

  const pasos: {
    stripe?: PasoStripe;
    stripeOmitido?: string;
    storage?: PasoStorage;
    firestore?: PasoFirestore;
    auth?: boolean;
  } = {};

  try {
    /* 1. Stripe. */
    if (stripeConfigurado()) {
      pasos.stripe = await cortarStripe(uid, correo, devolverDinero);
    } else {
      /* Se sigue adelante, pero queda dicho: si había suscripción, sigue
         cobrando. No se oculta detrás de un "listo". */
      pasos.stripeOmitido =
        "Stripe no está configurado en este entorno. Si este usuario tenía suscripción, NO se canceló: revísalo a mano en el panel de Stripe.";
      console.error("Borrado sin Stripe configurado para", uid);
    }

    /* 2. Storage. */
    pasos.storage = await borrarStorage(uid);

    if (pasos.storage.quedan > 0) {
      await anotarEnAuditoria("borrado-de-usuario:pendiente", {
        porUid: quien.uid,
        uid,
        correo,
        pasos,
      });
      return res.status(200).json({
        ok: true,
        pendiente: true,
        uid,
        correo,
        pasos,
        aviso: `Quedan ${pasos.storage.quedan} archivos por borrar. La cuenta NO se ha borrado todavía: vuelve a lanzarlo para terminar.`,
      });
    }

    /* 3. Firestore. */
    pasos.firestore = await borrarFirestore(uid);

    /* 4. Auth, al final. */
    await authAdmin().deleteUser(uid);
    pasos.auth = true;

    await anotarEnAuditoria("borrado-de-usuario:termina", {
      porUid: quien.uid,
      porCorreo: quien.email,
      uid,
      correo,
      pasos,
    });

    return res.status(200).json({ ok: true, pendiente: false, uid, correo, pasos });
  } catch (error) {
    console.error("Administración: el borrado de", uid, "falló a medias:", error);
    await anotarEnAuditoria("borrado-de-usuario:falla", {
      porUid: quien.uid,
      uid,
      correo,
      pasos,
      error: String(error),
    });
    /* 200 con `ok: false` y los pasos: lo que ya se hizo no se deshace, y el
       admin necesita ver exactamente hasta dónde llegó para poder repetirlo o
       terminar a mano. Un 500 a secas le dejaría sin esa información. */
    return res.status(200).json({
      ok: false,
      error: "borrado-a-medias",
      uid,
      correo,
      pasos,
      aviso:
        "El borrado se interrumpió. Lo ya borrado no se recupera. Revisa los pasos y vuelve a lanzarlo: la operación se puede repetir sin romper nada.",
    });
  }
}
