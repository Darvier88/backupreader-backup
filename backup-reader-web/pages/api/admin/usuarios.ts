/**
 * La lista de usuarios para el panel de administración.
 *
 * Fuente de verdad: Firebase Auth. Firestore queda como complemento.
 * Es al revés de lo que parecería natural, y es a propósito: si un borrado
 * anterior quedó a medias, en Firestore puede no haber documento y la cuenta
 * seguir existiendo en Auth. Listando desde Auth esas cuentas huérfanas
 * aparecen y se pueden terminar de borrar; listando desde Firestore serían
 * invisibles justo cuando hace falta verlas.
 *
 * POR QUÉ NO SALE STRIPE AQUÍ
 * ---------------------------
 * Mirar Stripe cuesta tres llamadas por usuario (buscar cliente, listar
 * suscripciones, listar cobros). Con cincuenta usuarios son ciento cincuenta
 * llamadas y la tabla tarda medio minuto en pintar, o se corta por el límite
 * de tiempo de la función. Va en `detalle.ts`, que se pide de a un usuario
 * cuando el admin lo abre.
 *
 * Firestore, en cambio, sí entra: son tres consultas en total, no tres por
 * usuario. `collectionGroup("backups")` trae los chats de TODOS los usuarios
 * de una vez y se agrupan en memoria por el uid del padre.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { authAdmin, dbAdmin, soloSuperAdmin, esSuperAdmin } from "../../../lib/admin-servidor";

/** Tope de cuentas a traer de una vez. */
const TOPE = 1000;

export type UsuarioDeAdmin = {
  uid: string;
  correo: string;
  nombre: string | null;
  proveedores: string[];
  creado: number | null;
  ultimoAcceso: number | null;
  deshabilitado: boolean;
  correoVerificado: boolean;
  /** Lo que dice el documento de Firestore; null si no tiene. */
  plan: string | null;
  planCancelAt: number | null;
  tieneDocumento: boolean;
  tieneBoveda: boolean;
  chats: number;
  bytesCifrados: number;
  /** Para que la pantalla no ofrezca borrar a un admin ni a quien mira. */
  esAdmin: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const quien = await soloSuperAdmin(req, res);
  if (!quien) return;

  try {
    const cuentas = await authAdmin().listUsers(TOPE);

    /* Tres consultas para todos los usuarios, no tres por usuario. */
    const [docsUsuarios, docsBovedas, docsBackups] = await Promise.all([
      dbAdmin().collection("users").get(),
      dbAdmin().collection("vaults").get(),
      dbAdmin().collectionGroup("backups").get(),
    ]);

    /* El documento se guarda como { user: {...} }, no plano. */
    const porUid = new Map<string, any>();
    for (const d of docsUsuarios.docs) {
      const datos = d.data();
      porUid.set(d.id, datos?.user ?? datos ?? {});
    }

    const conBoveda = new Set(docsBovedas.docs.map((d) => d.id));

    const chatsPorUid = new Map<string, { chats: number; bytes: number }>();
    for (const d of docsBackups.docs) {
      /* vaults/{uid}/backups/{backupId} → el abuelo es el uid. */
      const uid = d.ref.parent.parent?.id;
      if (!uid) continue;
      const acc = chatsPorUid.get(uid) ?? { chats: 0, bytes: 0 };
      acc.chats++;
      acc.bytes += Number(d.data()?.cipherBytes ?? 0) || 0;
      chatsPorUid.set(uid, acc);
    }

    const usuarios: UsuarioDeAdmin[] = cuentas.users.map((u) => {
      const doc = porUid.get(u.uid);
      const acc = chatsPorUid.get(u.uid);
      return {
        uid: u.uid,
        correo: u.email ?? "",
        nombre: u.displayName ?? doc?.displayName ?? null,
        proveedores: u.providerData.map((p) => p.providerId),
        creado: u.metadata.creationTime
          ? Date.parse(u.metadata.creationTime) || null
          : null,
        ultimoAcceso: u.metadata.lastSignInTime
          ? Date.parse(u.metadata.lastSignInTime) || null
          : null,
        deshabilitado: u.disabled,
        correoVerificado: u.emailVerified,
        plan: doc?.plan ?? null,
        planCancelAt: doc?.planCancelAt ?? null,
        tieneDocumento: Boolean(doc),
        tieneBoveda: conBoveda.has(u.uid),
        chats: acc?.chats ?? 0,
        bytesCifrados: acc?.bytes ?? 0,
        esAdmin: esSuperAdmin(u.uid, u.email ?? ""),
      };
    });

    /* Los más nuevos primero: es lo que se mira al revisar un alta reciente. */
    usuarios.sort((a, b) => (b.creado ?? 0) - (a.creado ?? 0));

    /* Documentos de Firestore sin cuenta en Auth: restos de un borrado que
       quedó a medias, o de una cuenta borrada desde la consola. No se pueden
       listar como usuarios porque no hay a quién borrar en Auth, pero el
       admin tiene que saber que están ahí. */
    const huerfanos = [...porUid.keys()].filter(
      (uid) => !cuentas.users.some((u) => u.uid === uid)
    );

    return res.status(200).json({
      ok: true,
      usuarios,
      total: usuarios.length,
      hayMas: Boolean(cuentas.pageToken),
      huerfanos,
    });
  } catch (error) {
    console.error("Administración: fallo al listar usuarios:", error);
    return res.status(500).json({ ok: false, error: "fallo-al-listar" });
  }
}
