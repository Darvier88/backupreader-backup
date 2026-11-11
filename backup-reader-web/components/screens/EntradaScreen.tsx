import { FC, useContext, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { CarruselIlustraciones } from "../ui/CarruselIlustraciones";

import { AuthContext } from "../../context";
import { checkIfRegistered } from "../../config/providersAuth";

/**
 * Entrar o crear cuenta, en una sola pantalla (4a y 4b).
 *
 * UN SOLO CAMINO, NO DOS
 * ----------------------
 * Antes había dos pantallas, "Iniciar sesión" y "Crear cuenta", con un enlace
 * de una a otra. Eso obliga al usuario a responder una pregunta antes de
 * empezar —¿tengo cuenta aquí?— que muchas veces no sabe contestar: con Google
 * y Apple de por medio, la gente no recuerda si entró con el correo o con el
 * botón. Equivocarse costaba un error y un viaje a la otra pantalla.
 *
 * Ahora el mismo botón sirve para las dos cosas. Se pide el correo, se mira si
 * existe, y el paso 2 se adapta: contraseña a secas si ya hay cuenta, nombre y
 * contraseña si es nueva.
 *
 * SIN "REPETIR CONTRASEÑA"
 * ------------------------
 * Repetirla no comprueba lo que parece. Con los dos campos a la vista, el
 * segundo se copia del primero mirando, así que solo confirma que se ha
 * tecleado dos veces igual, no que sea la que se quería. El ojo para verla
 * hace ese trabajo de verdad, y con un campo menos.
 *
 * Esto NO es la contraseña de cifrado, que sí se confirma en dos pasos (5a y
 * 5b): aquella no se puede recuperar y esta sí.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

const correoValido = (valor: string) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i.test(valor.trim());

export const EntradaScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signUp, signInGoogle, signInApple } = useContext(AuthContext);

  const [paso, setPaso] = useState<"inicio" | "correo" | "clave">("inicio");
  const [esNueva, setEsNueva] = useState(false);
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [verla, setVerla] = useState(false);
  const [comprobando, setComprobando] = useState(false);

  /* Los errores van por campo y no en un bloque al final. Un mensaje debajo
     del botón obliga a releer el formulario entero para saber a qué campo se
     refiere; debajo del campo, ya está dicho. */
  const [errorCorreo, setErrorCorreo] = useState("");
  const [errorClave, setErrorClave] = useState("");

  const seguirConCorreo = async () => {
    const valor = correo.trim();
    if (!correoValido(valor)) {
      setErrorCorreo(enTexto(t("Escribe un correo válido.")));
      return;
    }
    setErrorCorreo("");
    setComprobando(true);
    try {
      const existe = await checkIfRegistered(valor);
      setEsNueva(!existe);
      setPaso("clave");
    } catch (error) {
      /* Si no se puede comprobar, se sigue como si la cuenta fuera nueva: en
         el peor caso se pide un nombre de más, y crear sobre un correo que ya
         existe lo rechaza Firebase con su propio mensaje. Bloquear aquí sería
         dejar al usuario sin entrar por un fallo de red. */
      console.error("No se pudo comprobar si el correo ya tiene cuenta:", error);
      setEsNueva(true);
      setPaso("clave");
    } finally {
      setComprobando(false);
    }
  };

  const enviar = () => {
    if (clave.length === 0) {
      setErrorClave(enTexto(t("Escribe tu contraseña.")));
      return;
    }
    if (esNueva && clave.length < 8) {
      setErrorClave(enTexto(t("Mínimo 8 caracteres")));
      return;
    }
    setErrorClave("");
    if (esNueva) signUp(correo.trim(), clave, nombre);
    else signIn(correo.trim(), clave);
  };

  const campo = (
    etiqueta: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    error: string,
    ayuda?: string,
    extra?: JSX.Element
  ) => (
    <div style={{ marginBottom: 16 }}>
      <label className="br-label">{etiqueta}</label>
      <div style={{ position: "relative" }}>
        <input
          {...props}
          className="br-input"
          style={{
            width: "100%",
            height: 52,
            paddingRight: extra ? 52 : undefined,
            borderColor: error ? "var(--aviso-borde)" : undefined,
          }}
        />
        {extra}
      </div>
      {(error || ayuda) && (
        <span
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 13,
            color: error ? "var(--aviso-texto)" : "var(--slate-500)",
          }}
        >
          {error || ayuda}
        </span>
      )}
    </div>
  );

  const ojo = (
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
        color: "var(--slate-500)",
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
  );

  const botonSocial = (
    etiqueta: string,
    onClick: () => void,
    fondo: string,
    color: string,
    borde: string,
    icono: JSX.Element
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 52,
        marginBottom: 10,
        borderRadius: 10,
        border: borde,
        background: fondo,
        color,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontFamily: "var(--font-sans)",
        fontSize: 15.5,
        fontWeight: 600,
      }}
    >
      {icono}
      {etiqueta}
    </button>
  );

  return (
    <div className="br-root br-split">
      <div className="br-split-main">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          {paso === "inicio" && (
            <>
              <h1 className="br-page-title">{t("Guarda tus chats. Léelos cuando quieras.")}</h1>
              <p style={{ margin: "0 0 26px", fontSize: 15.5, color: "var(--slate-700)" }}>
                {t("Revisa fotos, textos y audios de cada conversación.")}
              </p>

              {/* En movil, donde no hay columna al lado, las laminas van aqui
                  de una en una (4a). En escritorio esta misma informacion la
                  pinta la columna de la derecha (7a), asi que aqui estorbaria. */}
              <div className="br-solo-movil">
                <CarruselIlustraciones compacto />
              </div>

              {/* Apple y Google van en sus estilos oficiales porque las dos
                  marcas lo exigen en sus condiciones de uso. */}
              {botonSocial(
                enTexto(t("Continuar con Apple")),
                signInApple,
                "#000000",
                "#FFFFFF",
                "1px solid #000000",
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M16.37 1.43c0 1.14-.42 2.22-1.17 3.03-.9.97-2.07 1.53-3.1 1.44-.03-1.1.46-2.23 1.18-3.01.8-.87 2.14-1.5 3.09-1.46zM20.4 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.38 3.5-4.1 3.52-1.53.01-1.92-1-4-.99-2.08.01-2.51 1.01-4.04 1-1.72-.02-3.04-1.78-4.03-3.33-2.77-4.36-3.06-9.48-1.35-12.2 1.21-1.93 3.13-3.06 4.93-3.06 1.84 0 2.99 1.01 4.5 1.01 1.47 0 2.37-1.01 4.49-1.01 1.61 0 3.31.88 4.52 2.4-3.97 2.18-3.33 7.85.61 9.7z" />
                </svg>
              )}
              {botonSocial(
                enTexto(t("Continuar con Google")),
                signInGoogle,
                "#FFFFFF",
                "#1F1F1F",
                "1px solid #747775",
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}

              {/* El `display` en linea gana a la clase, asi que la clase va en
                  un envoltorio sin estilos propios. Si se pusiera junta, el
                  separador seguiria viendose en escritorio aunque el CSS
                  dijera que no. */}
              <div className="br-solo-movil">
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--slate-500)" }}>
                  {t("O")}
                </span>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              </div>

              {/* En escritorio el correo va EN LINEA, sin pantalla aparte: es
                  un clic menos y alli sobra el sitio. En movil se mantiene el
                  boton que lleva al paso 1, porque meter un campo mas en la
                  primera pantalla empuja los botones de Apple y Google fuera
                  del alcance del pulgar, que es donde el diseno los quiere.
                  (7a frente a 4a.) */}
              <div className="br-solo-escritorio" style={{ marginTop: 18 }}>
                {campo(
                  enTexto(t("O con tu correo")),
                  {
                    type: "email",
                    value: correo,
                    placeholder: enTexto(t("tucorreo@email.com")),
                    onChange: (e) => {
                      setCorreo(e.target.value);
                      setErrorCorreo("");
                    },
                    onKeyDown: (e) => {
                      if (e.key === "Enter") seguirConCorreo();
                    },
                  },
                  errorCorreo
                )}
                <button
                  type="button"
                  onClick={seguirConCorreo}
                  disabled={comprobando}
                  className="br-btn br-btn-primary br-btn-lg"
                  style={{ width: "100%", minHeight: 52, cursor: comprobando ? "default" : "pointer", opacity: comprobando ? 0.6 : 1 }}
                >
                  {comprobando ? t("Comprobando…") : t("Continuar")}
                </button>
              </div>

              <div className="br-solo-movil">
                <button
                  type="button"
                  onClick={() => setPaso("correo")}
                  className="br-btn br-btn-ghost"
                  style={{ width: "100%", minHeight: 52, borderRadius: 10, cursor: "pointer" }}
                >
                  {t("Continuar con correo")}
                </button>
              </div>
            </>
          )}

          {paso === "correo" && (
            <>
              <span className="br-eyebrow">{t("Paso 1 de 2")}</span>
              <h1 className="br-page-title">{t("Tu correo")}</h1>
              {campo(
                enTexto(t("Correo electrónico")),
                {
                  type: "email",
                  value: correo,
                  autoFocus: true,
                  placeholder: enTexto(t("tucorreo@email.com")),
                  onChange: (e) => {
                    setCorreo(e.target.value);
                    setErrorCorreo("");
                  },
                  onKeyDown: (e) => {
                    if (e.key === "Enter") seguirConCorreo();
                  },
                },
                errorCorreo
              )}
              <button
                type="button"
                onClick={seguirConCorreo}
                disabled={comprobando}
                className="br-btn br-btn-primary br-btn-lg"
                style={{ width: "100%", minHeight: 52, cursor: comprobando ? "default" : "pointer", opacity: comprobando ? 0.6 : 1 }}
              >
                {comprobando ? t("Comprobando…") : t("Continuar")}
              </button>
            </>
          )}

          {paso === "clave" && (
            <>
              <span className="br-eyebrow">{t("Paso 2 de 2")}</span>
              <h1 className="br-page-title">
                {esNueva ? t("Crea tu cuenta") : t("Escribe tu contraseña")}
              </h1>
              <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--slate-700)" }}>
                {esNueva
                  ? enTexto(t("Es tu primera vez con {{correo}}.", { correo: correo.trim() }))
                  : correo.trim()}{" "}
                <span
                  className="br-link"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setPaso("correo");
                    setClave("");
                    setErrorClave("");
                  }}
                >
                  {t("Cambiar")}
                </span>
              </p>

              {esNueva &&
                campo(
                  enTexto(t("Nombre")),
                  {
                    value: nombre,
                    autoFocus: true,
                    onChange: (e) => setNombre(e.target.value),
                  },
                  ""
                )}

              {campo(
                enTexto(t("Contraseña")),
                {
                  type: verla ? "text" : "password",
                  value: clave,
                  autoFocus: !esNueva,
                  autoComplete: esNueva ? "new-password" : "current-password",
                  onChange: (e) => {
                    setClave(e.target.value);
                    setErrorClave("");
                  },
                  onKeyDown: (e) => {
                    if (e.key === "Enter") enviar();
                  },
                },
                errorClave,
                esNueva
                  ? enTexto(t("Toca el ojo para verla. No hace falta repetirla."))
                  : undefined,
                ojo
              )}

              {/* El botón se queda siempre activo. Uno gris no dice qué falta,
                  y obliga a adivinar; al pulsarlo, el error aparece bajo el
                  campo que lo causa. */}
              <button
                type="button"
                onClick={enviar}
                className="br-btn br-btn-primary br-btn-lg"
                style={{ width: "100%", minHeight: 52, cursor: "pointer" }}
              >
                {esNueva ? t("Crear cuenta") : t("Entrar")}
              </button>

              {!esNueva && (
                <button
                  type="button"
                  onClick={() => router.push("/recuperar")}
                  style={{
                    marginTop: 14,
                    minHeight: 44,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14.5,
                    color: "var(--brass-600)",
                  }}
                >
                  {t("¿Olvidaste tu contraseña?")}
                </button>
              )}
            </>
          )}

          <p className="br-fineprint" style={{ marginTop: 22 }}>
            {t("Al continuar aceptas la")}{" "}
            <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/privacyPolicy")}>
              {t("Política de privacidad")}
            </span>{" "}
            {t("y los")}{" "}
            <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/termsConditions")}>
              {t("Términos")}
            </span>
            .
          </p>
        </div>
      </div>

      {/* Columna de ilustraciones (7a). Las mismas tres laminas que en movil
          rotan, aqui quietas y a la vez: hay sitio y tres cosas quietas se
          comparan de un vistazo, mientras que tres que giran hay que
          esperarlas. */}
      <aside className="br-aside br-solo-escritorio">
        <CarruselIlustraciones />
      </aside>
    </div>
  );
};

export default EntradaScreen;
