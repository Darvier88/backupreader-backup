import { FC, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { CarruselIlustraciones } from "../ui/CarruselIlustraciones";
import { ENTRAR_CON_APPLE, RECUPERAR_CONTRASENA } from "../../lib/funciones-activas";
import { BotonAtras, Trazo } from "../ui/Paso";
import { Logo } from "../ui/BrandChrome";

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

  /* El foco automático, solo en escritorio.
     En un móvil, enfocar un campo hace que el navegador lo desplace a la
     vista y levante el teclado. Como la cabecera es pegajosa, el usuario
     llegaba a «Crea tu cuenta» con la página ya bajada 270 px: el título y
     el primer campo quedaban tapados por la cabecera y lo primero que veía
     era un campo a medias sin saber en qué pantalla estaba. En escritorio no
     pasa —no hay teclado que levantar— y ahorra un clic. */
  const [conTeclado, setConTeclado] = useState(false);
  useEffect(() => {
    setConTeclado(window.matchMedia("(min-width: 721px)").matches);
  }, []);

  const [paso, setPaso] = useState<"inicio" | "correo" | "clave">("inicio");

  /* En el móvil, los pasos del correo y de la contraseña van sin la cabecera
     del logo (4b): solo la flecha y «Paso x de 2». La regla CSS solo actúa
     por debajo de 720 px; en escritorio la cabecera se queda. */
  useEffect(() => {
    document.body.classList.toggle("br-sin-cabecera", paso !== "inicio");
    return () => document.body.classList.remove("br-sin-cabecera");
  }, [paso]);
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
    extra?: JSX.Element,
    junto?: JSX.Element
  ) => (
    <div style={{ marginBottom: 16 }}>
      {junto ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <label className="br-label">{etiqueta}</label>
          {junto}
        </div>
      ) : (
        <label className="br-label">{etiqueta}</label>
      )}
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
      {/* Columna de ilustraciones (7a), a la IZQUIERDA: el contexto a un lado y
          la tarea a la derecha, igual que en el plan, la clave y recuperar. Las mismas tres laminas que en movil
          rotan, aqui quietas y a la vez: hay sitio y tres cosas quietas se
          comparan de un vistazo, mientras que tres que giran hay que
          esperarlas. */}
      <aside className="br-aside br-solo-escritorio" style={{ borderLeft: "none", borderRight: "1px solid var(--border)" }}>
        {/* Logo arriba, lámina en el centro y la frase abajo (7a). */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 400, margin: "0 auto" }}>
          <Logo onClick={() => router.push("/")} />
          <div style={{ flex: 1, marginTop: 24 }}>
            <CarruselIlustraciones pie={enTexto(t("Revisa fotos, textos y audios de cada conversación."))} />
          </div>
        </div>
      </aside>
      <div className="br-split-main br-movil-alto">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          {paso === "inicio" && (
            <>
              {/* En escritorio (7a) la etiqueta y la frase de «entra en
                  segundos» van aquí, y «Revisa fotos…» pasa a la columna de
                  las láminas. En móvil (4a) se queda como estaba. */}
              {/* En móvil las láminas van ARRIBA, antes del título (4a). En
                  escritorio las pinta la columna de la izquierda (7a). */}
              <div className="br-solo-movil" style={{ marginBottom: 20 }}>
                <CarruselIlustraciones compacto />
              </div>
              <div className="br-solo-escritorio"><span className="br-eyebrow">{t("Tus chats, cifrados")}</span></div>
              <h1 className="br-page-title">{t("Guarda tus chats. Léelos cuando quieras.")}</h1>
              <p className="br-solo-movil" style={{ margin: "0 0 26px", fontSize: 15.5, color: "var(--slate-700)" }}>
                {t("Revisa fotos, textos y audios de cada conversación.")}
              </p>
              <p className="br-solo-escritorio" style={{ margin: "0 0 26px", fontSize: 15.5, color: "var(--slate-700)" }}>
                {t("Entra en segundos. Si es tu primera vez, creamos tu cuenta.")}
              </p>

              {/* Apple y Google van en sus estilos oficiales porque las dos
                  marcas lo exigen en sus condiciones de uso.
                  Apple está apagado por ahora: ver `lib/funciones-activas.ts`. */}
              {ENTRAR_CON_APPLE && botonSocial(
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
              {/* 6px arriba y abajo, como el diseño (4a), no 18.
                  Con 18 el «Continuar con correo» quedaba flotando lejos de
                  los otros dos y dejaba de leerse como la tercera opción de
                  la misma lista. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--slate-500)" }}>
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
              {/* Escritorio (7a): separador «O con tu correo» y el campo con
                  «Continuar» en la MISMA fila: un clic menos que en móvil. */}
              <div className="br-solo-escritorio" style={{ marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 14px" }}>
                  <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)" }}>
                    {t("O con tu correo")}
                  </span>
                  <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="email"
                      aria-label={enTexto(t("Correo electrónico"))}
                      className="br-input"
                      value={correo}
                      placeholder={enTexto(t("tucorreo@ejemplo.com"))}
                      onChange={(e) => {
                        setCorreo(e.target.value);
                        setErrorCorreo("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") seguirConCorreo();
                      }}
                      style={{ width: "100%", height: 48, borderColor: errorCorreo ? "var(--aviso-borde)" : undefined }}
                    />
                    {errorCorreo && (
                      <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "var(--aviso-texto)" }}>{errorCorreo}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={seguirConCorreo}
                    disabled={comprobando}
                    className="br-btn br-btn-ghost"
                    style={{ height: 48, padding: "0 18px", borderColor: "var(--ink-900)", cursor: comprobando ? "default" : "pointer", opacity: comprobando ? 0.6 : 1 }}
                  >
                    {comprobando ? t("Comprobando…") : t("Continuar")}
                  </button>
                </div>
              </div>

              <div className="br-solo-movil">
                <button
                  type="button"
                  onClick={() => setPaso("correo")}
                  className="br-btn br-btn-ghost"
                  /* Tercera opción, sin borde y con el sobre (4a): Google es
                     la principal. Mismo alto, cuerpo y peso que los botones
                     de arriba, que es lo que lo mantiene en la misma lista;
                     lo que cambia es que no lleva fondo ni borde. */
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: "none",
                    background: "transparent",
                    gap: 10,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--ink-900)",
                  }}
                >
                  <Trazo tipo="sobre" tam={20} />
                  {t("Continuar con correo")}
                </button>
              </div>
            </>
          )}

          {paso === "correo" && (
            <>
              <div className="br-cabecera-paso br-solo-movil-flex">
                <BotonAtras etiqueta={enTexto(t("Atrás"))} onClick={() => setPaso("inicio")} />
                <span className="br-paso-etiqueta">{t("Paso 1 de 2")}</span>
              </div>
              <h1 className="br-page-title">{t("Tu correo")}</h1>
              {campo(
                enTexto(t("Correo electrónico")),
                {
                  type: "email",
                  value: correo,
                  autoFocus: conTeclado,
                  placeholder: enTexto(t("tucorreo@ejemplo.com")),
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
              {/* Abajo, al alcance del pulgar (4b). */}
              <div className="br-movil-abajo">
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
            </>
          )}

          {paso === "clave" && (
            <>
              <div className="br-cabecera-paso br-solo-movil-flex">
                <BotonAtras
                  etiqueta={enTexto(t("Atrás"))}
                  onClick={() => {
                    setPaso("correo");
                    setClave("");
                    setErrorClave("");
                  }}
                />
                <span className="br-paso-etiqueta">{t("Paso 2 de 2")}</span>
              </div>
              <h1 className="br-page-title">
                {/* "Hola de nuevo" y no "Escribe tu contraseña" (7b).
                    Quien vuelve ya sabe que toca la contraseña, la tiene
                    delante; lo que el titular puede hacer es reconocerle. */}
                {esNueva ? t("Crea tu cuenta") : t("Hola de nuevo")}
              </h1>
              <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--slate-700)" }}>
                {/* El correo en negrita (4b/7b): es lo que hay que comprobar. */}
                {(() => {
                  const c = correo.trim();
                  if (!esNueva) return <strong style={{ fontWeight: 600, color: "var(--ink-900)" }}>{c}.</strong>;
                  const frase = enTexto(t("Es tu primera vez con {{correo}}.", { correo: c }));
                  const i = c ? frase.indexOf(c) : -1;
                  if (i < 0) return frase;
                  return (
                    <>
                      {frase.slice(0, i)}
                      <strong style={{ fontWeight: 600, color: "var(--ink-900)" }}>{c}</strong>
                      {frase.slice(i + c.length)}
                    </>
                  );
                })()}{" "}
                {/* «Cambiar» solo en escritorio (7b). En el móvil (4b) la flecha
                    de atrás ya vuelve al correo. */}
                <span
                  className="br-link br-solo-escritorio-inline"
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
                    autoFocus: conTeclado,
                    placeholder: enTexto(t("Tu nombre")),
                    onChange: (e) => setNombre(e.target.value),
                  },
                  ""
                )}

              {campo(
                enTexto(t("Contraseña")),
                {
                  type: verla ? "text" : "password",
                  value: clave,
                  autoFocus: conTeclado && !esNueva,
                  autoComplete: esNueva ? "new-password" : "current-password",
                  placeholder: esNueva ? enTexto(t("Mínimo 8 caracteres")) : undefined,
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
                ojo,
                /* «¿La olvidaste?» junto al campo (7b), no debajo del botón:
                    se busca justo cuando se está mirando el campo vacío.
                    Apagado por ahora: ver `lib/funciones-activas.ts`. */
                esNueva || !RECUPERAR_CONTRASENA ? undefined : (
                  <button
                    type="button"
                    onClick={() => router.push("/recuperar")}
                    className="br-link"
                    style={{ background: "transparent", border: "none", padding: "8px 0", minHeight: 32, cursor: "pointer", fontSize: 14 }}
                  >
                    {t("¿La olvidaste?")}
                  </button>
                )
              )}

              {/* El botón se queda siempre activo. Uno gris no dice qué falta,
                  y obliga a adivinar; al pulsarlo, el error aparece bajo el
                  campo que lo causa. */}
              {/* Abajo, al alcance del pulgar (4b). */}
              <div className="br-movil-abajo">
              <button
                type="button"
                onClick={enviar}
                className="br-btn br-btn-primary br-btn-lg"
                style={{ width: "100%", minHeight: 52, cursor: "pointer" }}
              >
                {esNueva ? t("Crear cuenta") : t("Entrar")}
              </button>
              </div>

            </>
          )}

          {/* El aviso legal va con la elección de cómo entrar (4a/7a); en el
              paso de la contraseña (4b/7b) ya se aceptó. */}
          {paso !== "clave" && (
          <p className="br-fineprint" style={{ marginTop: 22, textAlign: "center", fontSize: 12.5, lineHeight: 1.5 }}>
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
          )}
        </div>
      </div>

    </div>
  );
};

export default EntradaScreen;
