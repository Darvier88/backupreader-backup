/**
 * Bloquear el desplazamiento del fondo, llevando la cuenta.
 *
 * POR QUÉ NO VALE HACERLO A MANO
 * ------------------------------
 * El patrón de siempre —guardar `body.style.overflow`, ponerlo en `hidden` y
 * devolverlo al salir— se rompe en cuanto hay dos cosas abiertas a la vez:
 *
 *   el menú bloquea      → guarda ""        y pone "hidden"
 *   la hoja bloquea      → guarda "hidden"  y pone "hidden"
 *   el menú desbloquea   → devuelve ""
 *   la hoja desbloquea   → devuelve "hidden"   ← y ahí se queda
 *
 * El `hidden` sobrevive a los dos, y entonces la página entera deja de poder
 * desplazarse por su cuenta. Peor aún, y más difícil de atribuir: `body` con
 * `overflow: hidden` pasa a ser el contenedor de desplazamiento de todo lo
 * que hay dentro, y como él no se desplaza, CUALQUIER `position: sticky` de
 * la aplicación deja de pegarse en silencio. Así es como la barra de
 * resultados del chat se iba de la vista al bajar aunque estuviera declarada
 * como pegada.
 *
 * Con una cuenta, el candado se abre cuando lo suelta el último y no el
 * primero, y el valor original se guarda una sola vez.
 */

let cuantos = 0;
let original: string | null = null;

/** Bloquea, y devuelve la función que lo suelta. Llamarla dos veces no cuenta dos. */
export function bloquearScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (cuantos === 0) {
    original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  cuantos++;

  let soltado = false;
  return () => {
    /* Que soltar dos veces no descuente dos: con React en modo estricto los
       efectos se montan y desmontan dos veces, y la cuenta quedaría en
       negativo y el candado abierto antes de tiempo. */
    if (soltado) return;
    soltado = true;
    cuantos = Math.max(0, cuantos - 1);
    if (cuantos === 0) {
      document.body.style.overflow = original ?? "";
      original = null;
    }
  };
}
