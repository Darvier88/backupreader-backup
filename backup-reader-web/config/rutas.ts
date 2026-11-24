/**
 * Qué páginas son privadas y cuáles exigen además un plan al día.
 *
 * POR QUÉ ESTO ESTÁ EN UN SOLO SITIO
 * ----------------------------------
 * Antes la comprobación era una lista escrita a mano dentro del componente que
 * redirige: «si viene de /login, /auth o /dashboard, mándalo a /plans». Tres
 * rutas sueltas. El problema de una lista así es que no se actualiza sola: el
 * día que se añade una página privada, nadie se acuerda de apuntarla, y el
 * fallo que deja no se nota porque la página FUNCIONA.
 *
 * Eso es justo lo que pasó. `/initialDashboard` pinta la tarjeta de subir
 * chats y no estaba en la lista, y `/backups/[id]` abre un backup y tampoco.
 * Desde `/plans`, pulsando Ayuda y luego el logo, se llegaba a
 * `/initialDashboard` y se podía usar la aplicación entera sin pagar.
 *
 * Por eso aquí las rutas se comparan POR PREFIJO: `/backups/loquesea` queda
 * cubierto sin tener que enumerar cada backup.
 *
 * DOS LISTAS, PORQUE SON DOS PREGUNTAS DISTINTAS
 * ----------------------------------------------
 * «¿Hace falta haber entrado?» y «¿hace falta tener plan?» no se responden
 * igual. A la pantalla de cuenta hay que poder llegar sin plan: es donde se
 * contrata y donde se gestiona el pago. Dejarla fuera del paso de pago no es
 * un descuido, es lo que evita encerrar a alguien que quiere pagar.
 */

/** Hace falta sesión. Sin ella, a la portada. */
const PRIVADAS = ["/dashboard", "/initialDashboard", "/backups", "/account"];

/** Hace falta además plan o prueba en curso. Sin eso, a /plans. */
const DE_PAGO = ["/dashboard", "/initialDashboard", "/backups"];

const empiezaPor = (ruta: string, lista: string[]) =>
  lista.some((p) => ruta === p || ruta.startsWith(p + "/"));

export const esRutaPrivada = (ruta: string) => empiezaPor(ruta, PRIVADAS);

export const exigePlan = (ruta: string) => empiezaPor(ruta, DE_PAGO);
