import { FC } from "react";
import { t } from "i18next";

import { UMBRALES_HORAS, type UmbralHoras } from "../../lib/analisis/iniciaMas";
import type { Medida } from "../../lib/analisis/tendencias";
import { ControlSegmentado } from "../ui/ControlSegmentado";
import { Detalle, Tarjeta, enTexto } from "./piezas";

/**
 * Los ajustes que cambian lo que dicen las cifras.
 *
 * Están a la vista y no escondidos porque no son preferencias de adorno: el
 * umbral de silencio DECIDE qué cuenta como una conversación, y con él
 * cambian cuántas hay y quién las empieza. Un número elegido por nosotros y
 * no enseñado haría que las cifras parecieran un hecho en vez de el
 * resultado de una decisión.
 */

export const Ajustes: FC<{
  umbralHoras: UmbralHoras;
  medida: Medida;
  autores: string[];
  yo?: string;
  onUmbral: (h: UmbralHoras) => void;
  onMedida: (m: Medida) => void;
  onYo: (autor: string | undefined) => void;
}> = ({ umbralHoras, medida, autores, yo, onUmbral, onMedida, onYo }) => (
  <>
    <Tarjeta titulo={enTexto(t("Cuándo empieza una conversación nueva"))}>
      <ControlSegmentado
        completo
        valor={String(umbralHoras)}
        onCambio={(v) => onUmbral(Number(v) as UmbralHoras)}
        opciones={UMBRALES_HORAS.map((h) => ({
          valor: String(h),
          etiqueta: enTexto(t("{{h}} h de silencio", { h })),
        }))}
      />
      <Detalle>
        {t(
          "Un chat no tiene principio ni final: lo que separa una conversación de la siguiente es un silencio largo, y cuánto es «largo» depende de vosotros. Cuatro horas parte bien el día de quien se escribe a diario; ocho, el de quien se escribe de vez en cuando."
        )}
      </Detalle>
    </Tarjeta>

    <Tarjeta titulo={enTexto(t("Qué se cuenta en las gráficas"))}>
      <ControlSegmentado
        completo
        valor={medida}
        onCambio={(v) => onMedida(v as Medida)}
        opciones={[
          { valor: "mensajes", etiqueta: enTexto(t("Mensajes")) },
          { valor: "palabras", etiqueta: enTexto(t("Palabras")) },
          { valor: "notasDeVoz", etiqueta: enTexto(t("Notas de voz")) },
        ]}
      />
      <Detalle>
        {t(
          "Un mes de cuarenta mensajes de una palabra y otro de cuarenta parrafadas no son el mismo mes. Y quien manda audios casi no aparece si solo se cuentan palabras."
        )}
      </Detalle>
    </Tarjeta>

    {autores.length > 0 && (
      <Tarjeta titulo={enTexto(t("Quién eres tú"))}>
        <ControlSegmentado
          completo
          valor={yo && autores.includes(yo) ? yo : ""}
          onCambio={(v) => onYo(v || undefined)}
          opciones={[
            ...autores.map((a) => ({ valor: a, etiqueta: a })),
            { valor: "", etiqueta: enTexto(t("Ninguno")) },
          ]}
        />
        <Detalle>
          {t(
            "Solo cambia cómo se te nombra aquí. Se guarda dentro del análisis cifrado, junto al resto: no sale de tu bóveda ni se queda en este navegador."
          )}
        </Detalle>
      </Tarjeta>
    )}
  </>
);

export default Ajustes;
