import { FC } from "react";
import { useTranslation } from "react-i18next";

/**
 * Los tres pasos que quedan tras crear la cuenta: plan, clave, confirmar.
 *
 * Aparece en 6a, 7c, 7d y 7e, siempre igual, con el paso en curso marcado.
 *
 * POR QUÉ SE ENSEÑA LA CUENTA ENTERA Y NO SOLO EL PASO ACTUAL
 * -----------------------------------------------------------
 * Después de pagar viene crear una clave de cifrado, y después confirmarla.
 * Si el usuario no sabe que eso viene, cada pantalla nueva parece un obstáculo
 * más puesto entre él y lo que vino a hacer, y es justo donde la gente
 * abandona: no por lo que se le pide, sino porque no sabe si se le va a seguir
 * pidiendo cosas indefinidamente. Ver "faltan tres" convierte una fila
 * indeterminada en algo que termina.
 *
 * En móvil ocupa una línea ("Paso 1 de 3") y en escritorio la columna en tinta
 * con los tres enunciados, porque allí sobra el sitio y los nombres de cada
 * paso anticipan lo que va a pedirse.
 */
export const PasosOnboarding: FC<{
  actual: 1 | 2 | 3;
  /** Columna completa (escritorio) o una sola línea (móvil). */
  variante?: "columna" | "linea";
}> = ({ actual, variante = "columna" }) => {
  const { t } = useTranslation();

  const pasos = [
    { titulo: t("Elige tu plan"), pie: t("Cancela cuando quieras.") },
    { titulo: t("Crea tu clave de cifrado"), pie: t("Solo tú la conoces.") },
    { titulo: t("Confírmala"), pie: t("Para asegurarnos de que la recuerdas.") },
  ];

  if (variante === "linea") {
    return (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--slate-500)",
        }}
      >
        {t("Cuenta creada")} · {t("Paso")} {actual} {t("de")} 3
      </span>
    );
  }

  return (
    <div
      style={{
        background: "var(--ink-950, #0B1220)",
        borderRadius: 12,
        padding: "26px 24px",
        height: "100%",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {t("Cuenta creada")}
      </span>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--paper-50)",
          margin: "8px 0 22px",
        }}
      >
        {t("Te faltan tres pasos.")}
      </h2>

      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {pasos.map((paso, i) => {
          const numero = i + 1;
          const hecho = numero < actual;
          const activo = numero === actual;
          return (
            <li
              key={paso.titulo}
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 18,
                /* Los pasos que aún no tocan se atenúan, pero se leen. Si se
                   escondieran, se perdería lo único que este bloque aporta:
                   saber qué viene después. */
                opacity: activo ? 1 : hecho ? 0.65 : 0.45,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  background: activo ? "var(--brass-400)" : "transparent",
                  border: activo ? "none" : "1px solid rgba(255,255,255,0.35)",
                  color: activo ? "var(--ink-950, #0B1220)" : "rgba(255,255,255,0.75)",
                }}
              >
                {hecho ? "✓" : `0${numero}`}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--paper-50)",
                  }}
                >
                  {paso.titulo}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {paso.pie}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PasosOnboarding;
