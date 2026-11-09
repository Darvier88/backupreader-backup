/**
 * Quién puede administrar, y si una confirmación de borrado corresponde al
 * usuario que se va a borrar.
 *
 * Son las dos decisiones que, si fallan, abren el panel a quien no debe o
 * borran a quien no toca. Están en un módulo aparte, sin importar nada, por
 * tres razones:
 *
 *  - Se pueden probar sin el Admin SDK ni credenciales. Un test que necesita
 *    media nube levantada para comprobar un `if` acaba sin escribirse.
 *  - Nada de aquí puede fallar por un problema de red o de configuración: son
 *    funciones puras sobre texto.
 *  - Se lee de una vez. Es poco código y conviene que se pueda revisar
 *    entero, porque es el que decide.
 */

function listaDeEnv(nombre: string): string[] {
  return (process.env[nombre] || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * ¿Es super admin?
 *
 * Sale de una variable de entorno, NO de un campo en Firestore. No es una
 * preferencia de estilo: hoy las reglas dejan que un usuario escriba su
 * propio documento `users/{uid}` completo, así que un flag `esAdmin` ahí sería
 * autoasignable desde la consola del navegador. Una variable de entorno solo
 * se cambia desde Vercel.
 *
 * Si no hay NINGÚN super admin configurado, nadie lo es. Importa que el caso
 * vacío cierre y no abra: con la condición escrita al revés —"si la lista está
 * vacía, pasan todos"— olvidarse de poner la variable en Vercel dejaría el
 * borrado de cuentas abierto a cualquier usuario registrado. El fallo por
 * defecto tiene que ser negar.
 */
export function esSuperAdmin(uid: string, correo: string): boolean {
  const uids = listaDeEnv("SUPER_ADMIN_UIDS");
  const correos = listaDeEnv("SUPER_ADMIN_EMAILS");

  if (uids.length === 0 && correos.length === 0) {
    console.error(
      "No hay super admin configurado: pon SUPER_ADMIN_UIDS (preferible) o SUPER_ADMIN_EMAILS."
    );
    return false;
  }

  if (uid && uids.includes(uid.toLowerCase())) return true;
  return correo ? correos.includes(correo.toLowerCase()) : false;
}

/**
 * ¿La confirmación que escribió el admin corresponde a este usuario?
 *
 * Se pide el correo, o el uid si la cuenta no tiene correo. No valen los dos:
 * si el uid sirviera siempre, el admin podría confirmar con el que ya tiene
 * copiado de otra fila sin llegar a mirar de quién es el correo, que es justo
 * la equivocación que esto tiene que atrapar.
 *
 * Se compara sin mayúsculas y sin espacios de los lados, porque el admin lo va
 * a copiar de la tabla y un espacio pegado de más no es confundir a una
 * persona con otra.
 */
export function confirmacionValida(
  confirmacion: unknown,
  correo: string,
  uid: string
): { vale: boolean; esperado: string } {
  const esperado = (correo || uid).trim().toLowerCase();
  const vale =
    typeof confirmacion === "string" &&
    esperado.length > 0 &&
    confirmacion.trim().toLowerCase() === esperado;
  return { vale, esperado };
}
