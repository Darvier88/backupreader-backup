import { FC, useState } from "react";
import { t } from "i18next";

import { Detalle, enTexto } from "./piezas";

/**
 * Por qué una cifra no cuadra.
 *
 * LISTA CERRADA, SIN CAMPO LIBRE
 * ------------------------------
 * El diseño proponía además un «cuéntanos más» abierto. No está, y es a
 * propósito: en un campo libre la gente pega trozos de su conversación para
 * explicarse («es que aquí Marta dice...»), y entonces la promesa de que el
 * texto del chat no sale de aquí la rompería el propio usuario sin darse
 * cuenta. Con cuatro motivos se sabe igual qué métrica se tuerce y por qué
 * clase de razón, que es lo único que hace falta para arreglarla.
 */

/** Los motivos. Son claves de i18n y también lo que se guarda. */
export const MOTIVOS = [
  "no se parece a lo que recuerdo",
  "falta o sobra gente",
  "las fechas o las horas están corridas",
  "otra cosa",
] as const;

export const HojaNoCuadra: FC<{
  /** Cómo se llama la métrica, para que la hoja diga de qué va. */
  titulo: string;
  onElegir: (motivo: string) => void;
  onCerrar: () => void;
}> = ({ titulo, onElegir, onCerrar }) => {
  const [motivo, setMotivo] = useState<string | null>(null);

  return (
    <div className="br-an-hoja" role="dialog" aria-label={enTexto(t("¿Qué no cuadra?"))}>
      <div className="br-an-hoja-cabecera">
        <span className="br-an-numeros-label">{titulo}</span>
        <button type="button" className="br-an-hoja-cerrar" onClick={onCerrar} aria-label={enTexto(t("Cerrar"))}>
          ×
        </button>
      </div>
      <p className="br-an-titular">{t("¿Qué no cuadra?")}</p>

      <div className="br-an-opciones">
        {MOTIVOS.map((m) => (
          <button
            key={m}
            type="button"
            className={motivo === m ? "br-an-opcion br-an-opcion--elegida" : "br-an-opcion"}
            aria-pressed={motivo === m}
            onClick={() => setMotivo(m)}
          >
            <span className="br-an-opcion-punto" aria-hidden="true" />
            <span className="br-an-opcion-titulo">{t(m)}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="br-btn br-btn-primary br-btn-md br-btn-block"
        disabled={!motivo}
        onClick={() => motivo && onElegir(motivo)}
      >
        {t("Enviar")}
      </button>
      <Detalle>
        {t("Se guarda qué métrica y cuál de estos motivos, dentro de tu bóveda cifrada. Nada del texto de tus mensajes.")}
      </Detalle>
    </div>
  );
};

export default HojaNoCuadra;
