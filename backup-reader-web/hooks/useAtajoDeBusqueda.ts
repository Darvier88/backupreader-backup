import { RefObject, useEffect } from "react";

/**
 * ⌘K (o Ctrl+K) lleva el cursor al buscador general. Escape lo suelta.
 *
 * POR QUÉ ESTE ATAJO Y NO OTRO
 * ----------------------------
 * ⌘K es lo que usan hoy casi todas las aplicaciones de escritorio para
 * buscar. Un atajo que ya está en los dedos no hay que enseñarlo, y uno
 * distinto hay que aprenderlo aunque sea "mejor".
 *
 * NO SE ROBA LA TECLA MIENTRAS SE ESCRIBE
 * ---------------------------------------
 * Si el usuario está escribiendo en otro campo, el atajo no actúa: en algunos
 * sistemas ⌘K es "insertar enlace" dentro de un texto, y robarlo en mitad de
 * una frase hace que la aplicación parezca que se cuelga. Solo se intercepta
 * cuando el foco no está en un campo de texto.
 *
 * Y solo se activa con la tecla de sistema pulsada (⌘ en Mac, Ctrl en el
 * resto): una "k" suelta la escribe la gente constantemente.
 */
export function useAtajoDeBusqueda(ref: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const escribiendo = (destino: EventTarget | null): boolean => {
      const el = destino as HTMLElement | null;
      if (!el) return false;
      const etiqueta = el.tagName;
      return (
        etiqueta === "INPUT" ||
        etiqueta === "TEXTAREA" ||
        etiqueta === "SELECT" ||
        el.isContentEditable
      );
    };

    const alPulsar = (e: KeyboardEvent) => {
      const conSistema = e.metaKey || e.ctrlKey;

      if (conSistema && e.key.toLowerCase() === "k") {
        /* El propio buscador sí responde al atajo: estando ya dentro, ⌘K
           vuelve a seleccionar lo escrito, que es lo que se espera para
           empezar una búsqueda nueva sin borrar a mano. */
        if (escribiendo(e.target) && e.target !== ref.current) return;
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
        return;
      }

      if (e.key === "Escape" && document.activeElement === ref.current) {
        ref.current?.blur();
      }
    };

    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [ref]);
}

export default useAtajoDeBusqueda;
