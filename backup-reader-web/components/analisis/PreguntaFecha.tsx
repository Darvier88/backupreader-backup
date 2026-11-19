import { FC, useState } from "react";
import i18n, { t } from "i18next";

import { Detalle, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * Cuando no se puede saber si 3/4 es el 3 de abril o el 4 de marzo.
 *
 * POR QUÉ SE PREGUNTA EN VEZ DE AVISAR
 * ------------------------------------
 * Un aviso deja el problema en manos de quien lee: «puede que esto esté
 * mal». Pero nosotros sabemos exactamente qué cifras dependen del día y
 * cuáles no, así que podemos enseñar las que aguantan y dejar las otras en
 * espera hasta que alguien nos diga el formato. Adivinar y poner una nota
 * debajo es lo peor de las dos opciones: la gráfica se ve, se recuerda, y
 * la nota no.
 *
 * El truco de la fecha de hoy es lo que de verdad resuelve la duda: nadie
 * sabe de memoria cómo escribe las fechas su teléfono, pero todo el mundo
 * puede mirar la pantalla y verlo.
 */
export const PreguntaFecha: FC<{
  /** Lo que se dedujo por defecto, del idioma del lector. */
  sugerido: boolean;
  onConfirmar: (diaPrimero: boolean) => void;
}> = ({ sugerido, onConfirmar }) => {
  const [elegido, setElegido] = useState<boolean | null>(null);
  const idioma = i18n.language || "es";

  /* El ejemplo se escribe con la fecha de hoy, que es lo que el usuario
     puede comprobar mirando su propio teléfono. */
  const hoy = new Date();
  const d = hoy.getDate();
  const m = hoy.getMonth() + 1;
  const comoHoy = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;

  const nombreDeMes = (mes: number) => {
    try {
      return new Intl.DateTimeFormat(idioma, { month: "long" }).format(new Date(2026, mes - 1, 1));
    } catch {
      return String(mes);
    }
  };

  const opciones: Array<{ diaPrimero: boolean; titulo: string; ejemplo: string }> = [
    {
      diaPrimero: true,
      titulo: enTexto(t("Día / mes")),
      ejemplo: `03/04/2026 = 3 ${enTexto(t("de"))} ${nombreDeMes(4)}`,
    },
    {
      diaPrimero: false,
      titulo: enTexto(t("Mes / día")),
      ejemplo: `03/04/2026 = 4 ${enTexto(t("de"))} ${nombreDeMes(3)}`,
    },
  ];

  return (
    <div className="br-an">
      <Tarjeta titulo={enTexto(t("Antes de contar"))}>
        <Titular>{t("No sabemos cómo leer las fechas")}</Titular>
        <Detalle>
          {t(
            "Ningún día de este archivo pasa de 12, así que 03/04 puede ser 3 de abril o 4 de marzo."
          )}
        </Detalle>

        <div className="br-an-opciones">
          {opciones.map((o) => (
            <button
              key={String(o.diaPrimero)}
              type="button"
              className={
                elegido === o.diaPrimero ? "br-an-opcion br-an-opcion--elegida" : "br-an-opcion"
              }
              aria-pressed={elegido === o.diaPrimero}
              onClick={() => setElegido(o.diaPrimero)}
            >
              <span className="br-an-opcion-punto" aria-hidden="true" />
              <span className="br-an-opcion-texto">
                <span className="br-an-opcion-titulo">{o.titulo}</span>
                <span className="br-an-opcion-ejemplo">{o.ejemplo}</span>
              </span>
            </button>
          ))}
        </div>

        <Detalle>
          {t(
            "Si dudas, mira la fecha de hoy en tu teléfono: si sale {{ejemplo}}, es día / mes.",
            { ejemplo: comoHoy }
          )}
        </Detalle>

        <button
          type="button"
          className="br-btn br-btn-primary br-btn-md br-btn-block"
          disabled={elegido === null}
          onClick={() => onConfirmar(elegido ?? sugerido)}
        >
          {t("Confirmar formato")}
        </button>
      </Tarjeta>

      {/* Qué se queda esperando y qué no. Enseñarlo evita que parezca que
          la pantalla está rota o que falta media función. */}
      <div className="br-an-espera-lista">
        <span className="br-an-numeros-label br-an-espera-label">
          {t("En espera hasta confirmar")}
        </span>
        <Detalle>
          {t("Mensajes por mes, días de la semana, tiempos de respuesta y tendencias.")}
        </Detalle>
        <span className="br-an-numeros-label br-an-espera-label">{t("Ya disponible")}</span>
        <Detalle>
          {t("Quién escribe más, palabras, emojis y a qué hora del día habláis.")}
        </Detalle>
      </div>
    </div>
  );
};

export default PreguntaFecha;
