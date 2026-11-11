import { FC, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext } from "../../context/StorageContext";
import { VaultContext } from "../../context/VaultContext";
import { ColumnaPasos } from "./ColumnaPasos";

/**
 * Desbloquear los chats, como un paso de la entrada (pantalla 4c).
 *
 * POR QUÉ DEJA DE SER UN AVISO
 * ----------------------------
 * Antes esto era una banda amarilla encima del panel. Una banda es algo que se
 * mira una vez y se aprende a ignorar: el usuario ve su lista de chats detrás,
 * cree que ya está dentro, y no entiende por qué no puede abrir ninguno ni
 * subir nada. El aviso explicaba el motivo, pero competía con toda la pantalla
 * que tenía detrás.
 *
 * Como paso, ocupa la pantalla y solo pide una cosa. Y como se puede omitir,
 * quien de verdad venía a otra cosa no se queda encerrado: pasa a la lista con
 * los chats bloqueados y una barra que lo recuerda (4d).
 *
 * EL FONDO EN TINTA NO ES DECORACIÓN
 * ----------------------------------
 * El resto de la aplicación es papel claro. Esta pantalla pide la contraseña
 * que descifra las conversaciones, que es lo más sensible que se escribe aquí,
 * y el cambio de fondo marca que se está en otro sitio. Es lo mismo que hace
 * un banco al pedir una clave.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/** Recuerda, solo durante esta pestaña, que ya se omitió el desbloqueo. */
const CLAVE_OMITIDO = "br:desbloqueo-omitido";

export function yaSeOmitio(): boolean {
  /* sessionStorage puede lanzar en ventanas privadas o con las cookies
     bloqueadas, y entonces lo correcto es comportarse como si no se hubiera
     omitido: enseñar el paso de más es molesto, saltárselo deja al usuario sin
     saber por qué no puede abrir sus chats. */
  try {
    return sessionStorage.getItem(CLAVE_OMITIDO) === "1";
  } catch {
    return false;
  }
}

export function marcarOmitido(): void {
  try {
    sessionStorage.setItem(CLAVE_OMITIDO, "1");
  } catch {
    /* Sin almacenamiento, el paso volverá a aparecer al recargar. Es el fallo
       menos malo de los dos. */
  }
}

export const PantallaDesbloqueo: FC<{ onOmitir: () => void }> = ({ onOmitir }) => {
  const { t } = useTranslation();
  const { unlock, unlockWithCode, errorMessage } = useContext(VaultContext);
  /* Cuántos chats esperan cerrados. En la columna de tinta se enseñan como
     filas con candado (8a): lo que tranquiliza no es la frase "tus chats
     están cifrados", es verlos ahí. */
  const { fileList } = useContext(StorageContext);
  const cuantos = Math.min(fileList?.length ?? 0, 3);

  /* "Olvide mi contrasena" cambia ESTE campo a codigo de recuperacion, en vez
     de abrir otro formulario encima. Es el mismo gesto que ya hacia el modal
     de desbloqueo, y mantiene la promesa de la pantalla: un solo campo. */
  const [modo, setModo] = useState<"clave" | "codigo">("clave");
  const [clave, setClave] = useState("");
  const [verla, setVerla] = useState(false);
  const [probando, setProbando] = useState(false);
  const [fallo, setFallo] = useState("");
  const campoRef = useRef<HTMLInputElement>(null);

  /* El foco va al campo al entrar: es el único control de la pantalla, y en un
     teclado físico ahorra el clic. */
  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  const intentar = async () => {
    if (!clave || probando) return;
    setProbando(true);
    setFallo("");
    try {
      const ok = modo === "clave" ? await unlock(clave) : await unlockWithCode(clave);
      if (!ok) {
        setFallo(
          enTexto(
            t(
              modo === "clave"
                ? "Esa contraseña no abre tus chats. Inténtalo de nuevo."
                : "Ese código de recuperación no vale. Revísalo e inténtalo de nuevo."
            )
          )
        );
        /* Se borra el campo para que el siguiente intento empiece limpio, pero
           NO se cierra la pantalla: equivocarse de contraseña es lo normal
           aquí, no un error que merezca sacar al usuario del paso. */
        setClave("");
        campoRef.current?.focus();
      }
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="br-paso">
      <ColumnaPasos
        encabezado={enTexto(t("Hola de nuevo"))}
        titulo={enTexto(t("Tus chats están cifrados en este dispositivo."))}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: cuantos }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
                {t("Chat cifrado")}
              </span>
            </div>
          ))}
        </div>
      </ColumnaPasos>

      <div className="br-paso-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="br-solo-movil" style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--paso-texto)" }}>
          BackupReader
        </span>
        {/* "Ahora no" y no una X (8a): deja claro que se sale del paso, no
            que se cierra una ventana por encima de algo, y dice en qué queda
            —no ahora, pero sigue pendiente—. Lleva al inicio bloqueado (4d). */}
        <button
          type="button"
          onClick={() => {
            marcarOmitido();
            onOmitir();
          }}
          style={{
            minHeight: 44,
            padding: "0 8px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            marginLeft: "auto",
            color: "var(--paso-tenue)",
          }}
        >
          {t("Ahora no")}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 420,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--paso-texto)",
            margin: "0 0 10px",
          }}
        >
          {t("Desbloquea tus chats")}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--paso-apagado)",
            margin: "0 0 26px",
          }}
        >
          {t(
            "Tus chats están cifrados con una contraseña que solo tú conoces. La necesitamos para abrirlos y para subir nuevos."
          )}
        </p>

        <label
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--paso-tenue)",
            marginBottom: 8,
          }}
        >
          {modo === "clave" ? t("Contraseña de cifrado") : t("Código de recuperación")}
        </label>

        <div style={{ position: "relative" }}>
          <input
            ref={campoRef}
            type={verla || modo === "codigo" ? "text" : "password"}
            value={clave}
            onChange={(e) => {
              setClave(e.target.value);
              setFallo("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") intentar();
            }}
            autoComplete={modo === "clave" ? "current-password" : "off"}
            style={{
              width: "100%",
              height: 52,
              padding: "0 52px 0 14px",
              borderRadius: 10,
              border: `1px solid ${fallo ? "var(--paso-aviso)" : "var(--paso-borde)"}`,
              background: "var(--paso-campo)",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              color: "var(--paso-texto)",
            }}
          />
          {/* Ver la contraseña en vez de pedir que se repita: repetirla a
              ciegas no comprueba que sea la que se quería, solo que se tecleó
              dos veces igual. */}
          <button
            type="button"
            aria-label={enTexto(t(verla ? "Ocultar contraseña" : "Ver contraseña"))}
            onClick={() => setVerla((v) => !v)}
            style={{
              position: "absolute",
              right: 4,
              top: 4,
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--paso-apagado)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {verla ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M1 1l22 22" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: fallo ? "var(--paso-aviso)" : "var(--paso-tenue)",
            margin: "8px 0 0",
          }}
        >
          {fallo ||
            errorMessage ||
            t(
              modo === "clave"
                ? "Es distinta a la de tu cuenta de Apple o Google."
                : "Es el código que guardaste al crear tu contraseña de cifrado."
            )}
        </p>

        <button
          type="button"
          onClick={intentar}
          disabled={!clave || probando}
          style={{
            marginTop: 22,
            width: "100%",
            minHeight: 52,
            borderRadius: 10,
            border: "none",
            cursor: !clave || probando ? "default" : "pointer",
            opacity: !clave || probando ? 0.5 : 1,
            background: "var(--paso-accion)",
            color: "var(--paso-accion-texto)",
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {probando ? t("Abriendo…") : t("Desbloquear")}
        </button>

        <button
          type="button"
          onClick={() => {
            setModo(modo === "clave" ? "codigo" : "clave");
            setClave("");
            setFallo("");
            campoRef.current?.focus();
          }}
          style={{
            marginTop: 18,
            minHeight: 44,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 14.5,
            color: "var(--paso-apagado)",
            textDecoration: "underline",
          }}
        >
          {modo === "clave"
            ? t("Olvidé mi contraseña de cifrado")
            : t("Usar mi contraseña")}
        </button>
      </div>
      </div>
    </div>
  );
};

export default PantallaDesbloqueo;
