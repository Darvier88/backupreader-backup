import { FC, useContext, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { FirestoreContext } from "../../context";

/**
 * Las preguntas frecuentes.
 *
 * PARA QUÉ ESTÁN
 * --------------
 * Un producto nuevo que pide subir conversaciones privadas y pagar por ello
 * tiene que responder, antes de que nadie pregunte, las cuatro cosas que
 * cualquiera se pregunta: qué cifrado usa, quién puede leer lo que subo, qué
 * pasa si pierdo la clave y dónde acaban mis datos. Callarlas no las hace
 * desaparecer; las deja en manos de quien atienda el correo de soporte, que
 * contestará cada vez una cosa distinta.
 *
 * TODO LO QUE SE AFIRMA AQUÍ ESTÁ COMPROBADO EN EL CÓDIGO
 * -------------------------------------------------------
 * Los algoritmos salen de `lib/backupreader-crypto`, la cuota sale del plan
 * que está en Firestore y la cancelación es la que hace `SubscriptionSection`.
 * Esto importa más de lo que parece: una respuesta de marketing que no case
 * con lo que hace el programa es peor que no tener respuesta, porque cuando
 * alguien lo descubra dejará de creerse también lo que sí era verdad.
 *
 * SE RESPONDE LO INCÓMODO
 * -----------------------
 * Que unos chats no se puedan recuperar jamás, o que los subidos antes de que
 * existiera el cifrado sigan sin cifrar hasta que el usuario los cifre, son
 * las dos respuestas que cuestan. Van enteras y sin suavizar. Son justo las
 * que demuestran que las demás se pueden creer.
 */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

type Pregunta = { p: string; r: string[] };

const Acordeon: FC<{ pregunta: Pregunta; abierta: boolean; alPulsar: () => void }> = ({
  pregunta,
  abierta,
  alPulsar,
}) => {
  const id = useId();
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={alPulsar}
          aria-expanded={abierta}
          aria-controls={id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            width: "100%",
            minHeight: 56,
            padding: "18px 0",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: serif,
            fontWeight: 500,
            fontSize: 18,
            lineHeight: 1.35,
            color: "var(--ink-900)",
          }}
        >
          <span>{pregunta.p}</span>
          {/* Un signo, no una flecha: gira sin necesitar un icono aparte y se
              entiende igual en cualquier idioma. */}
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brass-600)",
              fontSize: 20,
              lineHeight: 1,
              transform: abierta ? "rotate(45deg)" : "none",
              transition: "transform .18s ease",
            }}
          >
            +
          </span>
        </button>
      </h3>

      {abierta && (
        <div id={id} style={{ padding: "0 0 22px" }}>
          {pregunta.r.map((parrafo, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "12px 0 0",
                fontSize: 15.5,
                lineHeight: 1.65,
                color: "var(--slate-700)",
                maxWidth: "68ch",
              }}
            >
              {parrafo}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export const Preguntas: FC = () => {
  const { t } = useTranslation();
  const { subscription } = useContext(FirestoreContext);

  /* Una abierta cada vez. Con todas abiertas la página se convierte en un
     muro de texto y la lista de preguntas, que es lo que se viene a ojear,
     deja de verse de un vistazo. */
  const [abierta, setAbierta] = useState<number | null>(null);

  /* La cuota sale del plan que hay en Firestore, no de un número escrito aquí.
     Si algún día cambia el plan, esta respuesta cambia con él; escrita a mano
     se quedaría vieja sin que nadie se diera cuenta. */
  const plan = subscription?.[0];
  const cuota = plan
    ? `${enTexto(t(plan.details.benefit))}. ${enTexto(
        t("Cada conversación puede ocupar hasta {{n}} MB.", { n: plan.details.storage })
      )}`
    : enTexto(t("Lo verás en la pantalla de planes, con el precio al lado."));

  const preguntas: Pregunta[] = [
    {
      p: enTexto(t("¿Qué tipo de cifrado se usa?")),
      r: [
        enTexto(
          t(
            "Tus mensajes y tus archivos se cifran con XChaCha20-Poly1305, en bloques de 64 KB. No es AES-256, que es lo que suele nombrarse: es un algoritmo de la misma generación y la misma solidez, y la razón de elegirlo es que va más rápido en el navegador, que es donde se cifra todo aquí."
          )
        ),
        enTexto(
          t(
            "Tu contraseña de cifrado no se usa directamente para cifrar. Pasa primero por Argon2id, con 64 MB de memoria y tres pasadas, que es lo que convierte una contraseña en una clave y hace que probarlas a la fuerza salga carísimo. Con esa clave se envuelve otra clave, aleatoria, que es la que cifra de verdad tus chats."
          )
        ),
        enTexto(
          t(
            "Ese rodeo es lo que permite que tu código de recuperación funcione sin guardar tu contraseña en ningún sitio: la misma clave aleatoria va envuelta dos veces, una con tu contraseña y otra con el código."
          )
        ),
      ],
    },
    {
      p: enTexto(t("¿Puede el equipo de BackupReader leer mis chats?")),
      r: [
        enTexto(
          t(
            "No. El cifrado ocurre en tu teléfono o en tu ordenador, antes de que nada salga de ahí. Lo que llega a nuestros servidores son archivos cifrados y un índice cifrado; tu contraseña no se envía nunca, ni siquiera transformada. Sin ella no hay forma de abrir nada, y nosotros no la tenemos."
          )
        ),
        enTexto(
          t(
            "Hay una excepción honesta, y preferimos decirla: los chats que se subieron antes de que existiera el cifrado siguen guardados sin cifrar hasta que los cifres tú. La aplicación te los marca y te ofrece un botón para hacerlo. Mientras no lo pulses, esos chats concretos sí son legibles por quien tenga acceso al servidor."
          )
        ),
      ],
    },
    {
      p: enTexto(t("¿Qué pasa si olvido la contraseña y el código de recuperación?")),
      r: [
        enTexto(
          t(
            "Los chats se pierden. No es una política que podamos saltarnos haciendo una excepción: la clave que abre tus archivos solo existe dentro de dos envoltorios, uno que abre tu contraseña y otro que abre tu código. Si se pierden los dos, no queda nada en ninguna parte con lo que abrirlos, tampoco de nuestro lado."
          )
        ),
        enTexto(
          t(
            "Es el precio de que nadie más pueda leerlos. Un sistema donde soporte puede devolverte el acceso es un sistema donde soporte puede entrar. Por eso el código de recuperación se enseña una sola vez y te pedimos que confirmes que lo has guardado: guárdalo donde guardas las cosas que no puedes perder."
          )
        ),
      ],
    },
    {
      p: enTexto(t("¿Dónde se guardan mis datos?")),
      r: [
        enTexto(
          t(
            "En la infraestructura de Google Cloud, a través de Firebase: los archivos en Cloud Storage y los datos de la cuenta en Firestore. Los pagos los procesa Stripe, que recibe tu tarjeta y tu correo; nosotros no guardamos ningún número de tarjeta."
          )
        ),
        enTexto(
          t(
            "Da igual en qué país esté el servidor para lo que de verdad importa: lo que hay en él está cifrado con una clave que no sale de tu dispositivo. Una orden judicial, una filtración o un empleado curioso se encontrarían con archivos que no se pueden abrir."
          )
        ),
      ],
    },
    {
      p: enTexto(t("¿Cuánto almacenamiento incluye la suscripción?")),
      r: [
        cuota,
        enTexto(
          t(
            "Lo que ocupa cada conversación depende sobre todo de las fotos, los audios y los vídeos: un chat de solo texto, por largo que sea, apenas pesa."
          )
        ),
      ],
    },
    {
      p: enTexto(t("¿Puedo cancelar cuando quiera?")),
      r: [
        enTexto(
          t(
            "Sí, desde «Mi cuenta», sin escribir a nadie ni dar explicaciones. La cancelación se aplica al final del periodo que ya has pagado: no se te vuelve a cobrar, y hasta esa fecha sigues entrando con normalidad. No devolvemos la parte del mes en curso porque no la cortamos: la sigues usando."
          )
        ),
        enTexto(
          t(
            "Si además quieres que borremos tu cuenta y todo lo que has subido, escríbenos a info@backupreader.com desde el correo con el que te registraste."
          )
        ),
      ],
    },
  ];

  return (
    <section style={{ marginTop: 64 }}>
      <span className="br-section-label br-section-label-accent">{t("Preguntas")}</span>
      <h2
        style={{
          margin: "16px 0 24px",
          fontFamily: serif,
          fontWeight: 500,
          fontSize: "clamp(22px,3vw,30px)",
          letterSpacing: "-0.015em",
          color: "var(--ink-900)",
        }}
      >
        {t("Lo que suele preguntarse antes de subir el primer chat")}
      </h2>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        {preguntas.map((pregunta, i) => (
          <Acordeon
            key={i}
            pregunta={pregunta}
            abierta={abierta === i}
            alPulsar={() => setAbierta(abierta === i ? null : i)}
          />
        ))}
      </div>

      <p style={{ margin: "26px 0 0", fontSize: 15, lineHeight: 1.65, color: "var(--slate-500)" }}>
        {t("¿Te queda alguna duda? Escríbenos a info@backupreader.com y te contestamos.")}
      </p>

      <p
        style={{
          margin: "10px 0 0",
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--slate-500)",
        }}
      >
        {t("XChaCha20-Poly1305 · Argon2id · cifrado en tu dispositivo")}
      </p>
    </section>
  );
};

export default Preguntas;
