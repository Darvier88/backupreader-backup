import { FC, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { StorageContext } from "../../context/StorageContext";
import { VaultContext } from "../../context/VaultContext";
import { FirebaseAuth } from "../../config/firebase";
import { ColumnaPasos } from "./ColumnaPasos";
import { IconoPaso, Trazo } from "../ui/Paso";
import { Logo } from "../ui/BrandChrome";

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
  /* «Recordar en este dispositivo por 30 días» (8a). Desmarcada por defecto y
     solo en escritorio: en un teléfono la pantalla sigue siendo la de 4c. */
  const [recordar, setRecordar] = useState(false);
  const [nombre, setNombre] = useState("");
  useEffect(() => {
    const completo = FirebaseAuth.currentUser?.displayName?.trim() ?? "";
    setNombre(completo.split(/\s+/)[0] ?? "");
  }, []);
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
      const ok = modo === "clave" ? await unlock(clave, recordar) : await unlockWithCode(clave);
      if (!ok) {
        setFallo(
          enTexto(
            t(
              modo === "clave"
                ? "Esa clave no abre tus chats. Inténtalo de nuevo."
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

  const ahoraNo = () => {
    marcarOmitido();
    onOmitir();
  };

  const olvido = () => {
    setModo(modo === "clave" ? "codigo" : "clave");
    setClave("");
    setFallo("");
    campoRef.current?.focus();
  };

  const enlace: React.CSSProperties = {
    minHeight: 44,
    padding: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    textDecoration: "underline",
  };

  return (
    <div className="br-paso">
      <ColumnaPasos
        encabezado={
          nombre
            ? enTexto(t("Hola de nuevo, {{nombre}}", { nombre }))
            : enTexto(t("Hola de nuevo"))
        }
        titulo={enTexto(t("Tus chats están cifrados en este dispositivo."))}
      >
        {/* Filas con candado separadas por líneas (8a): lo que tranquiliza
            no es la frase, es ver los chats ahí. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: cuantos }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 0",
                borderTop: "1px solid var(--border-on-ink)",
                borderBottom: i === cuantos - 1 ? "1px solid var(--border-on-ink)" : undefined,
              }}
            >
              <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: "var(--ink-800)", border: "1px solid var(--border-on-ink)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-100)" }}>
                <Trazo tipo="candado" tam={15} />
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-100)" }}>
                {t("Chat cifrado")}
              </span>
            </div>
          ))}
        </div>
      </ColumnaPasos>

      <div className="br-paso-main">
        {/* Cabecera de móvil (4c): logo sobre tinta y la salida a la derecha.
            Es «Ahora no» y no «Salir»: lleva al inicio con los chats con
            candado (4d), que es lo que el diseño describe para quien omite. */}
        <div className="br-paso-solo-movil" style={{ margin: "-24px -20px 0" }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid var(--border-on-ink)" }}>
            <Logo oscuro compact />
            <button type="button" onClick={ahoraNo} style={{ ...enlace, textDecoration: "none", fontWeight: 600, color: "var(--ink-100)", padding: "0 8px" }}>
              {t("Ahora no")}
            </button>
          </div>
        </div>

        <div className="br-paso-cuerpo">
          <div className="br-paso-solo-movil"><IconoPaso tipo="candado" tono="sobreTinta" /></div>
          <div className="br-paso-solo-escritorio"><IconoPaso tipo="candado" tono="tinta" tam={48} /></div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500, lineHeight: 1.15, color: "var(--paso-texto)", margin: "24px 0 10px" }}>
            {t("Desbloquea tus chats")}
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: "var(--paso-apagado)", margin: "0 0 24px" }}>
            {/* «Clave de cifrado», no «contraseña» (8a): «contraseña» ya es la
                de la cuenta, y llamar igual a las dos es lo que hace que la
                gente escriba la equivocada. */}
            {t("Escribe tu clave de cifrado para abrirlos y subir nuevos.")}
          </p>

          <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--paso-texto)", marginBottom: 6 }}>
            {modo === "clave" ? t("Clave de cifrado") : t("Código de recuperación")}
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
                border: `1.5px solid ${fallo ? "var(--paso-aviso)" : "var(--paso-borde)"}`,
                background: "var(--paso-campo)",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                color: "var(--ink-900)",
              }}
            />
            {/* Ver la clave en vez de pedir que se repita. */}
            <button
              type="button"
              aria-label={enTexto(t(verla ? "Ocultar contraseña" : "Ver contraseña"))}
              onClick={() => setVerla((v) => !v)}
              style={{ position: "absolute", right: 4, top: 4, width: 44, height: 44, background: "transparent", border: "none", cursor: "pointer", color: "var(--slate-500)" }}
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

          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: fallo ? "var(--paso-aviso)" : "var(--paso-tenue)", margin: "8px 0 0" }}>
            {fallo ||
              errorMessage ||
              t(
                modo === "clave"
                  ? "Es distinta a la contraseña de tu cuenta."
                  : "Es el código que guardaste al crear tu contraseña de cifrado."
              )}
          </p>

          {/* «Recordar en este dispositivo por 30 días» (8a): desmarcada por
              defecto y solo en escritorio. */}
          {modo === "clave" && (
            <div className="br-paso-solo-escritorio" style={{ marginTop: 18 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" className="br-casilla" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.45, color: "var(--paso-texto)" }}>
                  {t("Recordar en este dispositivo por 30 días")}
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--paso-tenue)", marginTop: 2 }}>
                    {t("No la marques en un computador compartido.")}
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="br-paso-acciones">
            <button
              type="button"
              onClick={intentar}
              disabled={probando}
              style={{
                width: "100%",
                minHeight: 52,
                borderRadius: 10,
                border: "none",
                cursor: probando ? "default" : "pointer",
                opacity: probando ? 0.6 : 1,
                background: "var(--paso-accion)",
                color: "var(--paso-accion-texto)",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {probando ? t("Abriendo…") : t("Desbloquear")}
            </button>

            {/* Escritorio (8a): «Ahora no» a la izquierda y «Olvidé…» a la
                derecha, bajo el botón. En móvil «Ahora no» está arriba. */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="br-paso-solo-escritorio" onClick={ahoraNo} style={{ ...enlace, color: "var(--brass-600)" }}>
                {t("Ahora no")}
              </button>
              <button type="button" onClick={olvido} style={{ ...enlace, marginLeft: "auto", marginRight: "auto", color: "var(--paso-apagado)" }} className="br-olvide">
                {modo === "clave" ? t("Olvidé mi clave de cifrado") : t("Usar mi clave")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PantallaDesbloqueo;
