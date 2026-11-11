import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";

/**
 * La columna en tinta de los pasos de bóveda (7d, 7e y 8a).
 *
 * Solo se ve en escritorio. En móvil no hay sitio para dos columnas y toda la
 * pantalla va en tinta, así que esto sobra y el CSS la esconde.
 *
 * Lo que lleva cambia según el momento —cuántos pasos faltan al registrarse,
 * o cuántos chats esperan cerrados al volver—, pero el marco es el mismo a
 * propósito: es el mismo sitio de la aplicación, el de las cosas que se
 * cifran, y que se vea igual es lo que lo hace reconocible.
 */
export const ColumnaPasos: FC<{
  encabezado: string;
  titulo: string;
  children?: ReactNode;
}> = ({ encabezado, titulo, children }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const enlace: React.CSSProperties = {
    minHeight: 44,
    padding: "0 10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: 14.5,
    color: "rgba(255,255,255,0.7)",
  };

  return (
    <aside className="br-paso-aside">
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--paper-50)" }}>
        BackupReader
      </span>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 320 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {encabezado}
        </span>
        <h2
          style={{
            margin: "8px 0 24px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.2,
            color: "var(--paper-50)",
          }}
        >
          {titulo}
        </h2>
        {children}
      </div>

      {/* Ayuda y salir, abajo. En móvil esto es el "Salir" de la cabecera: el
          mismo escape, en el sitio donde cabe en cada tamaño. */}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" style={enlace} onClick={() => router.push("/help")}>
          {t("Ayuda")}
        </button>
        <button type="button" style={enlace} onClick={() => router.push("/account")}>
          {t("Mi cuenta")}
        </button>
      </div>
    </aside>
  );
};

export default ColumnaPasos;
