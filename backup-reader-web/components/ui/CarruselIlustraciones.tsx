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
const PASO = 5000;

export const CarruselIlustraciones: FC<{ compacto?: boolean }> = ({ compacto }) => {
  const { t } = useTranslation();

  const laminas: Lamina[] = [
    {
      imagen: "/redesign/reviewing-a-whatsapp-conversation.svg",
      titulo: t("Tus chats, enteros") as string,
      texto: t("Fotos, audios y videos tal como los enviaste, no solo el texto.") as string,
    },
    {
      imagen: "/redesign/free-space-from-your-phone.svg",
      titulo: t("Sitio libre en el teléfono") as string,
      texto: t("Guarda la conversación aquí y bórrala del móvil sin perderla.") as string,
    },
    {
      imagen: "/redesign/information-will-always-be-yours.svg",
      titulo: t("Cifrado con una clave que solo tú conoces") as string,
      texto: t("Ni nosotros podemos leer lo que subes.") as string,
    },
  ];

  const [actual, setActual] = useState(0);
  const [parado, setParado] = useState(false);

  useEffect(() => {
    if (!compacto || parado) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => setActual((i) => (i + 1) % laminas.length), PASO);
    return () => window.clearInterval(id);
  }, [compacto, parado, laminas.length]);

  if (!compacto) {
    /* Escritorio: las tres a la vez, en columna. */
    return (
      <div className="br-aside-inner">
        {laminas.map((l) => (
          <div className="br-aside-item" key={l.titulo}>
            <img src={l.imagen} alt="" />
            <h2>{l.titulo}</h2>
            <p>{l.texto}</p>
          </div>
        ))}
      </div>
    );
  }

  const l = laminas[actual];
  return (
    <div style={{ margin: "0 0 26px" }}>
      <img
        src={l.imagen}
        alt=""
        style={{ width: "100%", maxWidth: 260, height: 124, objectFit: "contain", display: "block", margin: "0 auto 14px" }}
      />
      <h2
        style={{
          margin: "0 0 6px",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 19,
          lineHeight: 1.25,
          color: "var(--ink-900)",
        }}
      >
        {l.titulo}
      </h2>
      <p style={{ margin: 0, textAlign: "center", fontSize: 14.5, lineHeight: 1.55, color: "var(--slate-700)" }}>
        {l.texto}
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
        {laminas.map((otra, i) => (
          <button
            key={otra.titulo}
            type="button"
            aria-label={`${i + 1} / ${laminas.length}`}
            aria-current={i === actual}
            onClick={() => {
              setActual(i);
              setParado(true);
            }}
            /* 28px de alto para que el dedo acierte, aunque el punto que se
               ve mida 7: un objetivo táctil de 7px no se puede pulsar. */
            style={{
              width: 28,
              height: 28,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: i === actual ? "var(--brass-500)" : "var(--paper-300, var(--border))",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default CarruselIlustraciones;
