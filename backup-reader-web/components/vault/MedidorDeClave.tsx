import { FC } from "react";
import { useTranslation } from "react-i18next";

import { medirFuerza, MIN_LARGO, type Nivel } from "../../lib/fuerza-de-clave";

/**
 * La barra de fuerza de la clave de cifrado (pantalla 5a).
 *
 * Responde mientras se escribe. La comprobación de antes era «al menos 10
 * caracteres» y solo aparecía al pulsar el botón, lo que enseña a cumplir el
 * mínimo y nada más.
 *
 * El texto nombra lo que le pasa a la clave —corta, simple, buena— y no
 * promete un tiempo de descifrado: no medimos entropía de verdad, y dar una
 * cifra inventada sobre algo que no se puede recuperar sería peor que no dar
 * ninguna.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

const colorDe = (nivel: Nivel): string => {
  if (nivel === "corta") return "var(--border)";
  if (nivel === "simple") return "var(--aviso-borde)";
  /* Verde en «buena» y «excelente» (5a/7d), con el mismo verde del «Las
     claves coinciden» de la pantalla siguiente. */
  return "var(--paso-ok, var(--accent, #2E7D5B))";
};

export const MedidorDeClave: FC<{ clave: string }> = ({ clave }) => {
  const { t } = useTranslation();
  const { nivel, puntos } = medirFuerza(clave);

  const texto =
    nivel === "corta"
      ? enTexto(t("Mínimo {{n}} caracteres", { n: MIN_LARGO }))
      : nivel === "simple"
      ? enTexto(t("Simple · añade otra palabra"))
      : nivel === "buena"
      ? /* «Buena · Mínimo 10 caracteres» (5a): recuerda la regla sin que
           parezca un error. */
        `${enTexto(t("Buena"))} · ${enTexto(t("Mínimo {{n}} caracteres", { n: MIN_LARGO }))}`
      : enTexto(t("Excelente"));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: i < puntos ? colorDe(nivel) : "var(--border)",
            }}
          />
        ))}
      </div>
      <span
        style={{
          display: "block",
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:
            nivel === "simple"
              ? "var(--aviso-texto)"
              : nivel === "corta"
              ? "var(--slate-500)"
              : "var(--paso-ok, var(--accent, #2E7D5B))",
        }}
      >
        {texto}
      </span>
    </div>
  );
};

export default MedidorDeClave;
