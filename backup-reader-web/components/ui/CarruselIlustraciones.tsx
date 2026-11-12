import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Las tres cosas que hace la aplicación, con dibujo (pantallas 4a y 7a).
 *
 * POR QUÉ ESTÁ EN LA PANTALLA DE ENTRAR
 * -------------------------------------
 * Quien llega aquí desde un enlace puede no haber visto la portada nunca. Lo
 * único que veía era un título, dos botones y un campo de correo, sin nada que
 * dijera qué se guarda ni quién puede leerlo, que es justo lo que uno quiere
 * saber antes de dar su correo a un sitio donde va a subir sus
 * conversaciones.
 *
 * DOS FORMAS, UN SOLO CONTENIDO
 * -----------------------------
 * En escritorio hay sitio para una columna y las tres se leen de un vistazo,
 * sin movimiento: tres cosas quietas se comparan, tres cosas que rotan hay que
 * esperarlas. En móvil no cabe una columna al lado, así que van de una en una
 * y van pasando solas.
 *
 * EL CARRUSEL SE PARA AL TOCARLO
 * ------------------------------
 * Si el usuario pulsa un punto, quiere ver ese y no el siguiente. Un carrusel
 * que sigue girando después de que lo toquen le quita de delante lo que acaba
 * de pedir.
 *
 * Y NO GIRA SI SE PIDIÓ QUIETO
 * ----------------------------
 * `prefers-reduced-motion` lo deja fijo en el primero con sus puntos. Para
 * quien marca esa preferencia, el movimiento automático no es un adorno: puede
 * producir mareo o dolor de cabeza.
 */

type Lamina = { imagen: string; titulo: string; texto: string };

/** Cada cuánto pasa de lámina, en milisegundos. */
const PASO = 2000;

export const CarruselIlustraciones: FC<{ compacto?: boolean; pie?: string }> = ({ compacto, pie }) => {
  const { t } = useTranslation();

  const laminas: Lamina[] = [
    {
      /* Las mismas tres láminas y en el mismo orden que el diseño (4a, 7a). */
      imagen: "/redesign/review-photos-text-of-a-whatsapp-conversation.svg",
      titulo: t("Tus chats, enteros") as string,
      texto: t("Fotos, audios y videos tal como los enviaste, no solo el texto.") as string,
    },
    {
      imagen: "/redesign/multiple-versions-of-a-chat.svg",
      titulo: t("Cifrado con una clave que solo tú conoces") as string,
      texto: t("Ni nosotros podemos leer lo que subes.") as string,
    },
    {
      imagen: "/redesign/free-space-from-your-phone.svg",
      titulo: t("Sitio libre en el teléfono") as string,
      texto: t("Guarda la conversación aquí y bórrala del móvil sin perderla.") as string,
    },
  ];

  const [actual, setActual] = useState(0);
  const [parado, setParado] = useState(false);

  /* Rota sola, en bucle, cada dos segundos.
     Antes daba una sola vuelta y se detenía en la última lámina. El problema
     es que quien llega a la pantalla con el formulario ya en pantalla no ve
     esa única vuelta, y a partir de ahí los puntos parecen decorativos: hay
     tres, pero nada se mueve nunca. En bucle, el que mira dos segundos ve
     que hay más de una cosa que contar.

     Se para en cuanto el usuario toca un punto: entonces quiere ver esa, no
     la siguiente. */
  useEffect(() => {
    if (parado) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      setActual((i) => (i + 1) % laminas.length);
    }, PASO);
    return () => window.clearInterval(id);
  }, [parado, laminas.length]);

  const l = laminas[actual];

  const puntos = (
    <div style={{ display: "flex", justifyContent: compacto ? "center" : "flex-start", gap: 2, marginTop: compacto ? 10 : 0 }}>
      {laminas.map((otra, i) => (
        <button
          key={otra.titulo}
          type="button"
          aria-label={`${i + 1} / ${laminas.length}: ${otra.titulo}`}
          aria-current={i === actual}
          onClick={() => {
            setActual(i);
            setParado(true);
          }}
          /* 28px de alto para que el dedo acierte, aunque el punto mida 5. */
          style={{ width: i === actual ? 32 : 18, height: 28, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer" }}
        >
          {/* El activo es una píldora (4a, 7a). */}
          <span
            style={{
              width: i === actual ? 18 : 5,
              height: 5,
              borderRadius: 999,
              transition: "width 360ms ease",
              background: i === actual ? "var(--brass-500)" : "var(--paper-300, var(--border))",
            }}
          />
        </button>
      ))}
    </div>
  );

  /* El texto de cada lámina sigue existiendo para quien no ve la imagen. */
  const imagen = (alto: number, ancho: number) => (
    <img
      key={l.imagen}
      src={l.imagen}
      alt={`${l.titulo}. ${l.texto}`}
      className="br-lamina"
      style={{ width: "100%", maxWidth: ancho, height: alto, objectFit: "contain", display: "block", margin: "0 auto" }}
    />
  );

  if (!compacto) {
    /* Escritorio (7a): una lámina grande en el centro de la columna, la
       frase en serif abajo y los puntos debajo. */
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 420 }}>
        {/* Centrada en la columna, como en 7a. */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>{imagen(300, 380)}</div>
        {pie && (
          <p style={{ margin: "0 0 16px", fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 22, lineHeight: 1.3, color: "var(--ink-900)" }}>
            {pie}
          </p>
        )}
        {puntos}
      </div>
    );
  }

  /* Móvil (4a): la lámina en una tarjeta de papel, con los puntos debajo. */
  return (
    <div style={{ margin: "0 0 20px" }}>
      <div style={{ background: "var(--paper-100)", borderRadius: 14, padding: "22px 16px" }}>{imagen(176, 260)}</div>
      {puntos}
    </div>
  );
};

export default CarruselIlustraciones;
