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
  };

  const cerrar = () => {
    if (esteBorrando) return; // a mitad del barrido, cerrar no cancela nada
    setAbierto(false);
    setAviso(null);
  };

  return (
    <>
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
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: 999,
          border: "1px solid transparent",
          background: "transparent",
          cursor: otroBorrando ? "default" : "pointer",
          opacity: otroBorrando ? 0.4 : 0.55,
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
      >
        <Modal.Header>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              color: "var(--ink-900)",
            }}
          >
            {t("Borrar este chat")}
          </span>
        </Modal.Header>

        <Modal.Body>
          <p style={{ fontSize: 15, color: "var(--slate-700)", margin: 0 }}>
            {name}
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
            {t(
              "Se borran del servidor los mensajes y todos los archivos de este chat. No se puede deshacer: como están cifrados con tu clave, ni siquiera nosotros podemos recuperarlos."
            )}
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
            {t("La copia que tengas en tu teléfono o en tu computadora no se toca.")}
          </p>

          {aviso && (
            <p
              style={{
                fontSize: 13.5,
                color: "#A4442F",
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
          <Button auto light onPress={cerrar} disabled={esteBorrando}>
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
