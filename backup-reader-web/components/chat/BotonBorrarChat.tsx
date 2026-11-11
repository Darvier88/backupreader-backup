import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@nextui-org/react";

import { StorageContext } from "../../context/StorageContext";
import type { ClaveAviso } from "../../lib/borrar-chat";

/**
 * `t()` puede devolver null según sus tipos, así que no encaja donde se espera
 * un string. Mismo apaño que en `PaymentCard`, y por el mismo motivo: el
 * código nuevo no tiene por qué sumar errores de tipos a los que ya hay.
 */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/**
 * Botón para borrar un chat, con su confirmación.
 *
 * Vive en cada fila de la barra lateral, junto a la flecha. Es pequeño y gris
 * a propósito: abrir un chat es lo que se hace cien veces y borrarlo una, así
 * que el borrado no debe competir visualmente con lo normal.
 *
 * CONFIRMA CON UN DIALOGO, NO CON DOS CLICS
 * -----------------------------------------
 * `BotonCifrar`, que está al lado, confirma pulsando dos veces. Aquí no vale:
 * cifrar también borra el original, pero solo después de verificar que la copia
 * cifrada se puede releer, así que no se pierde nada. Esto no tiene copia. Lo
 * que se borra no se recupera, ni desde la aplicación ni pidiéndolo por
 * soporte, porque el servidor nunca tuvo la clave. Un diálogo que dice el
 * nombre del chat y obliga a mover el ratón a otro sitio es el mínimo
 * razonable.
 *
 * No se pide escribir el nombre, como sí hace el panel de administración con
 * el correo. Allí el riesgo es equivocarse de fila entre cuentas parecidas y
 * borrarle los datos a otra persona; aquí el usuario borra lo suyo, ve el
 * nombre en el diálogo, y pedirle que lo teclee sería ceremonia sin beneficio.
 */
export const BotonBorrarChat = ({
  fullPath,
  name,
}: {
  fullPath: string;
  name: string;
}) => {
  const { t } = useTranslation();
  const { borrarChatDelUsuario, borrandoChat } = useContext(StorageContext);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  /* El nombre del archivo tal cual ("WhatsApp Chat - Yuli.zip") no se lee
     bien dentro de una pregunta. Se quita la extension y el prefijo que pone
     WhatsApp al exportar, que no aportan nada aqui y alargan el titulo. */
  const nombreLimpio = (name || "")
    .replace(/\.zip$/i, "")
    .replace(/^(WhatsApp |Chat de WhatsApp con |WhatsApp Chat - )/i, "")
    .trim() || name;

  const esteBorrando = borrandoChat === fullPath;
  const otroBorrando = !!borrandoChat && !esteBorrando;

  /**
   * La frase para cada motivo, armada aquí y no en la librería.
   *
   * En inglés el orden cambia, así que hace falta una frase entera por caso
   * con la cifra como variable, no trozos traducidos y pegados.
   */
  const frase = (clave: ClaveAviso, cantidad: number): string => {
    switch (clave) {
      case "quedaron-archivos":
        return t(
          "Quedaron {{cantidad}} archivo(s) sin borrar. El chat sigue en la lista: vuelve a intentarlo.",
          { cantidad }
        ) as string;
      case "registro-no-borrado":
        return t(
          "Los archivos se borraron, pero el chat sigue en la lista. Vuelve a intentarlo para quitarlo."
        ) as string;
      case "ya-hay-borrado":
        return t("Ya hay un borrado en curso. Espera a que termine.") as string;
      case "chat-no-reconocido":
        return t("No se reconoce este chat.") as string;
      case "sin-sesion":
        return t("Tu sesión se cerró. Vuelve a entrar.") as string;
      default:
        return t("No se pudo borrar el chat. Inténtalo de nuevo.") as string;
    }
  };

  const alConfirmar = async () => {
    setAviso(null);
    const r = await borrarChatDelUsuario(fullPath);
    if (r.aviso) {
      /* Quedó algo a medias. El diálogo se queda abierto con el motivo: si se
         cerrara, el chat seguiría en la lista sin ninguna explicación y
         parecería que el botón no hizo nada. */
      setAviso(frase(r.aviso, r.fallidos));
      return;
    }
    setAbierto(false);
    /* Aviso breve, sin boton de deshacer: no hay nada que deshacer, los
       archivos ya no estan. Un boton de deshacer que no puede deshacer es
       peor que ninguno. Solo confirma que lo pedido ocurrio, porque la fila
       desaparece y sin acuse queda la duda de si fue eso o un fallo. */
    setHecho(true);
    window.setTimeout(() => setHecho(false), 3500);
  };

  const cerrar = () => {
    if (esteBorrando) return; // a mitad del barrido, cerrar no cancela nada
    setAbierto(false);
    setAviso(null);
  };

  return (
    <>
      {hecho && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 1400,
            padding: "10px 18px",
            borderRadius: 999,
            background: "var(--ink-900)",
            color: "var(--paper-50)",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            boxShadow: "var(--shadow-md, 0 6px 24px rgba(15,24,38,.22))",
            pointerEvents: "none",
          }}
        >
          {t("Chat eliminado")}
        </div>
      )}
      <button
        type="button"
        aria-label={enTexto(t("Borrar chat"))}
        title={enTexto(t("Borrar este chat"))}
        disabled={otroBorrando}
        onClick={(e) => {
          /* Sin esto el clic burbujea a la fila y abre el chat que se quiere
             borrar, que es justo lo contrario de lo pedido. */
          e.stopPropagation();
          setAbierto(true);
        }}
        /* 44px en movil, que es lo que pide un objetivo tactil, y 28 en
           escritorio, donde se apunta con el raton. La clase la hace aparecer
           solo al pasar el cursor por la fila (9c), pero NO en movil: alli no
           hay cursor que pasar, asi que esconderla la haria inalcanzable. */
        className="br-papelera"
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          borderRadius: 999,
          border: "1px solid transparent",
          background: "transparent",
          cursor: otroBorrando ? "default" : "pointer",
          opacity: otroBorrando ? 0.4 : undefined,
          color: "var(--slate-500)",
        }}
      >
        {esteBorrando ? (
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>…</span>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        )}
      </button>

      <Modal
        closeButton={!esteBorrando}
        preventClose={esteBorrando}
        open={abierto}
        onClose={cerrar}
        width="420px"
        className="br-hoja-borrado"
      >
        <Modal.Header>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              color: "var(--ink-900)",
            }}
          >
            {/* Se nombra el chat exacto en el titulo, no en una linea aparte:
                lo que evita borrar el equivocado es leer su nombre en la
                pregunta, no debajo de ella. */}
            {enTexto(t("¿Eliminar el chat con {{nombre}}?", { nombre: nombreLimpio }))}
          </span>
        </Modal.Header>

        <Modal.Body>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--slate-500)",
              marginTop: 10,
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            {t("Borraremos sus mensajes, fotos, videos y audios de BackupReader.")}
          </p>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--slate-500)",
              marginTop: 10,
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            {/* Que no se puede deshacer Y que hacer si se arrepiente. Decir
                solo lo primero deja al usuario con el susto y sin salida; la
                segunda frase convierte un aviso en una instruccion. */}
            <strong style={{ fontWeight: 600 }}>{t("Esta acción no se puede deshacer.")}</strong>{" "}
            {t("Para recuperarlo tendrías que volver a subir el .zip.")}
          </p>

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--brass-600)",
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            {t("Tu chat en WhatsApp no cambia")}
          </p>

          {aviso && (
            <p
              style={{
                fontSize: 13.5,
                color: "var(--aviso-texto)",
                marginTop: 12,
                marginBottom: 0,
                lineHeight: 1.5,
              }}
            >
              {aviso}
            </p>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button auto light autoFocus onPress={cerrar} disabled={esteBorrando}>
            {t("Cancelar")}
          </Button>
          {/* Arcilla, no el rojo de NextUI.
              `color="error"` pinta un rojo de alarma, el de "algo ha fallado".
              Aqui no ha fallado nada: el usuario ha pedido borrar y esto es la
              confirmacion de lo que pidio. El rojo de error en un boton que
              funciona bien gasta el unico color que deberia significar
              problema, y ademas asusta en un sitio donde solo hace falta que
              el usuario se detenga un segundo. El diseno pide arcilla. */}
          <Button
            auto
            onPress={alConfirmar}
            disabled={esteBorrando}
            css={{
              bg: "var(--clay-600)",
              color: "var(--paper-50)",
              "&:hover": { bg: "var(--clay-600)", filter: "brightness(0.92)" },
            }}
          >
            {esteBorrando ? t("Borrando…") : t("Borrar")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default BotonBorrarChat;
