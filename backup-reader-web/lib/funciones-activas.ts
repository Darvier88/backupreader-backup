/**
 * Funcionalidades que se pueden apagar sin borrar su código.
 *
 * POR QUÉ UN INTERRUPTOR Y NO BORRAR
 * ----------------------------------
 * Borrar una pantalla que funciona para volver a escribirla dentro de dos
 * semanas cuesta más que dejarla apagada, y en el camino se pierden las
 * decisiones que se tomaron al hacerla. Un interruptor deja el trabajo hecho,
 * probado y fuera de la vista, y volver a encenderlo es cambiar un `false`.
 */

/**
 * Recuperar la contraseña de la cuenta por correo (pantallas 5d, 5e y 5f).
 *
 * APAGADO a propósito, a petición del dueño del producto. Está entero y
 * probado: la pantalla de pedir el enlace, la de escribir la contraseña nueva
 * y el correo que lo manda desde nuestro backend. Lo que falta para encenderlo
 * no es código, es contratar el proveedor de correo y poner sus variables
 * (ver el comentario de `lib/correo/enviar.ts`).
 *
 * Mientras esté en `false`:
 *   - «¿La olvidaste?» no sale en la pantalla de entrar.
 *   - `/recuperar` y `/accion` llevan al inicio, también escribiendo la URL.
 *
 * OJO AL ENCENDERLO: los enlaces que Firebase manda por su cuenta siguen
 * apuntando a su propia página mientras no se pueda cambiar la URL de acción
 * en la consola. Con esto apagado nadie puede pedir uno desde la aplicación,
 * así que no hay enlaces sueltos dando vueltas.
 */
export const RECUPERAR_CONTRASENA = false;
