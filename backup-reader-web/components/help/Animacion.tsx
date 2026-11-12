import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Una animación, en el idioma y la forma que toquen.
 *
 * HAY CUATRO ARCHIVOS POR ANIMACIÓN
 * ---------------------------------
 * Español e inglés, y horizontal y vertical. El idioma es obvio; la forma no
 * tanto: una animación de 16x10 metida en una columna de móvil se queda en una
 * franja de 90 píxeles de alto donde no se distingue qué se está tocando en la
 * pantalla, que es justo lo único que el vídeo tenía que enseñar.
 *
 * SE ELIGE DESPUÉS DE MONTAR, NO ANTES
 * ------------------------------------
 * El ancho de la ventana no existe en el render de servidor. Si se decidiera
 * allí, el servidor y el navegador pintarían cosas distintas y React
 * protestaría; peor aún, el primero en cargarse sería el que no toca y se
 * descargarían 2,7 MB para nada. Hasta saberlo se deja el hueco reservado con
 * la proporción correcta, así que la página no pega un salto al aparecer.
 *
 * NI AUTOPLAY NI BUCLE
 * --------------------
 * Son vídeos con voz y duran más de medio minuto. Uno que arranca solo en
 * cuanto entras en la página habla por encima de lo que estés escuchando y te
 * obliga a buscar dónde pararlo. Se pulsa para verlo.
 */

/** A partir de aquí hay sitio para la versión horizontal. */
const CORTE = 720;

export const Animacion: FC<{
  /** Nombre base del archivo, sin idioma ni proporción. */
  base: string;
  /** Texto para quien no puede ver el vídeo. */
  descripcion: string;
  /** Imagen de portada, si la hay. */
  poster?: string;
}> = ({ base, descripcion, poster }) => {
  const { i18n } = useTranslation();
  const [ancha, setAncha] = useState<boolean | null>(null);

  useEffect(() => {
    /* Horizontal si hay ancho de escritorio O si la pantalla está apaisada:
       un móvil girado (667x375) no debe recibir el vídeo vertical, que a todo
       el ancho mediría más de 1000 px de alto. */
    const mirar = () => setAncha(window.innerWidth >= CORTE || window.innerWidth > window.innerHeight);
    mirar();
    window.addEventListener("resize", mirar);
    return () => window.removeEventListener("resize", mirar);
  }, []);

  const idioma = (i18n.language || "es").startsWith("en") ? "en" : "es";
  const proporcion = ancha ? "16x10" : "9x16";
  const src = `/videos/${base}-${idioma}-${proporcion}.mp4`;

  /* LA CAJA TIENE LA PROPORCIÓN EXACTA DEL ARCHIVO Y OCUPA TODO EL ANCHO
     Los vídeos miden 1080x1920 (9:16, móvil) y 1920x1200 (16:10,
     escritorio). La caja usa esa misma proporción y el ancho entero de la
     tarjeta, así que el vídeo la llena sin franjas a los lados ni arriba y
     abajo. Antes se limitaba al 70 % del alto de la pantalla y en móviles
     anchos quedaban dos bandas oscuras.

     La proporción va con el truco del `padding-top` en porcentaje y no con
     `aspect-ratio`: funciona igual en todos los navegadores, incluidos los
     Safari viejos. Nada de `aspect-ratio` junto a `max-height`: cada
     navegador resuelve distinto esa mezcla (Safari encogía el ancho y dejaba
     la caja pegada a la izquierda). El vídeo va encima, absoluto. */
  const vertical = ancha === false;
  const proporcion100 = vertical ? (16 / 9) * 100 : (10 / 16) * 100;

  return (
    <div style={{ width: "100%", background: "var(--ink-900)", borderBottom: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ position: "relative", width: "100%" }}>
        <div style={{ paddingTop: `${proporcion100}%` }} />
        {ancha !== null && (
          <video
            /* La clave fuerza a recrear el elemento al cambiar de archivo. Sin
               ella, al cambiar de idioma el navegador se queda con el vídeo
               anterior ya cargado y no pide el nuevo. */
            key={src}
            src={src}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            aria-label={descripcion}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", background: "var(--ink-900)" }}
          />
        )}
      </div>
    </div>
  );
};

export default Animacion;
