import { FC, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";

import { FirebaseAuth } from "../../config/firebase";
import { Logo } from "../ui/BrandChrome";
import { MedidorDeClave } from "../vault/MedidorDeClave";
import { medirFuerza } from "../../lib/fuerza-de-clave";

/**
 * Los enlaces que Firebase manda por correo, atendidos aquí (pantalla 5f).
 *
 * POR QUÉ ESTA PANTALLA EXISTE
 * ----------------------------
 * Hasta ahora, el enlace de «¿olvidaste tu contraseña?» llevaba a una página
 * alojada por Google: fondo blanco, tipografía de Google, el nombre del
 * proyecto de Firebase en vez del de la aplicación. Alguien que acaba de pedir
 * recuperar su cuenta en un sitio donde guarda sus conversaciones aterriza en
 * una página que no se parece en nada a la que estaba usando, y eso es
 * exactamente lo que enseñamos a la gente a reconocer como phishing.
 *
 * ATIENDE LOS TRES MODOS, NO SOLO LA CONTRASEÑA
 * ---------------------------------------------
 * Esto no es por completitud. La consola de Firebase tiene UNA sola «URL de
 * acción» para las cuatro plantillas de correo: en cuanto se apunta aquí,
 * también llegan los enlaces de verificar el correo y los de deshacer un
 * cambio de dirección. Si esta pantalla solo supiera de contraseñas, el día
 * que se cambie el ajuste se romperían los otros dos sin que nadie se entere
 * hasta que un usuario se queje.
 *
 * LA DISTINCIÓN QUE MÁS CONFUNDE
 * ------------------------------
 * Aquí se cambia la contraseña de la CUENTA. La clave de cifrado es otra y no
 * se toca: los chats siguen cifrados con ella y se pedirá al entrar. Quien no
 * lea eso aquí va a creer que ya tiene acceso a todo y se encontrará la
 * pantalla de desbloqueo sin esperarla. Por eso se dice antes de guardar, no
 * después.
 *
 * NO DICE SI EL CÓDIGO ES DE UNA CUENTA QUE EXISTE
 * ------------------------------------------------
 * No hace falta: el código ya viene de un correo que llegó a esa persona. Lo
 * que sí se enseña es a qué dirección pertenece, porque quien tiene dos
 * cuentas necesita saber cuál está cambiando.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

type Modo = "resetPassword" | "verifyEmail" | "recoverEmail";

type Estado =
  | { fase: "comprobando" }
  | { fase: "enlace-malo"; motivo: string }
  | { fase: "pedir-clave"; correo: string }
  | { fase: "guardando"; correo: string }
  | { fase: "listo"; titulo: string; detalle: string };

/** Lee un parámetro de la URL sin depender del router, que tarda en estar listo. */
function deLaUrl(nombre: string): string {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.search).get(nombre) || "";
  } catch {
    return "";
  }
}

export const AccionCorreoScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>({ fase: "comprobando" });
  const [clave, setClave] = useState("");
  const [verla, setVerla] = useState(false);
  const [fallo, setFallo] = useState("");

  const codigo = deLaUrl("oobCode");
  const modo = deLaUrl("mode") as Modo | "";
  const continuar = deLaUrl("continueUrl");

  /* UNA sola vez, pase lo que pase con los renders.
     `applyActionCode` GASTA el código: la segunda llamada con el mismo código
     falla siempre. Y este efecto se ejecuta más de una vez por razones que no
     tienen nada que ver con el enlace —React lo repite en desarrollo, y
     cualquier dependencia que cambie lo volvería a disparar—, así que sin
     este cerrojo el usuario veía «tu correo está verificado» durante un
     instante y acto seguido «este enlace no sirve», sobre un correo que sí
     se había verificado. Comprobado con enlaces reales del emulador. */
  const yaSeUso = useRef(false);

  /* Comprobar el código ANTES de enseñar ningún campo.
     Si el enlace ya venció o se usó, lo peor sería dejar escribir una
     contraseña nueva, con su medidor y todo, para decir que no vale al pulsar
     guardar. Se comprueba primero y se dice enseguida. */
  useEffect(() => {
    if (yaSeUso.current) return;
    yaSeUso.current = true;

    /* Sin bandera de «sigo montado», a propósito.
       Lo normal sería cancelar en la limpieza del efecto, pero aquí se
       juntaban las dos cosas y se anulaban: React ejecuta el efecto, lo
       limpia y lo vuelve a ejecutar; la segunda vez el cerrojo de arriba lo
       detiene, y la primera ya se había marcado como cancelada. Resultado:
       nadie escribía el estado y la pantalla se quedaba en «Comprobando el
       enlace…» para siempre. Escribir el estado de un componente ya
       desmontado no hace nada en React 18, así que no hace falta la bandera. */
    const fallar = (motivo: string) => setEstado({ fase: "enlace-malo", motivo });

    const caducado = () =>
      enTexto(
        t(
          "Este enlace ya no vale: se usó o pasó más de una hora desde que se envió. Pide uno nuevo."
        )
      );

    (async () => {
      if (!codigo || !modo) {
        fallar(enTexto(t("Este enlace está incompleto. Ábrelo desde el correo que te enviamos.")));
        return;
      }

      try {
        if (modo === "resetPassword") {
          const correo = await verifyPasswordResetCode(FirebaseAuth, codigo);
          setEstado({ fase: "pedir-clave", correo });
          return;
        }

        if (modo === "verifyEmail") {
          await applyActionCode(FirebaseAuth, codigo);
          setEstado({
            fase: "listo",
            titulo: enTexto(t("Tu correo está verificado")),
            detalle: enTexto(t("Ya puedes entrar con normalidad.")),
          });
          return;
        }

        if (modo === "recoverEmail") {
          /* `checkActionCode` antes de aplicar, porque es lo único que dice a
             qué dirección se vuelve. Después de aplicarlo el código ya no
             sirve para preguntarlo, y el usuario se quedaría sin saber con
             qué correo entra ahora. */
          const info = await checkActionCode(FirebaseAuth, codigo);
          const anterior = info.data?.email || "";
          await applyActionCode(FirebaseAuth, codigo);
          setEstado({
            fase: "listo",
            titulo: enTexto(t("Recuperaste tu correo")),
            detalle: anterior
              ? enTexto(t("Tu cuenta vuelve a ser {{correo}}. Cambia tu contraseña si no reconoces este cambio.", { correo: anterior }))
              : enTexto(t("Cambia tu contraseña si no reconoces este cambio.")),
          });
          return;
        }

        fallar(enTexto(t("Este enlace está incompleto. Ábrelo desde el correo que te enviamos.")));
      } catch {
        fallar(caducado());
      }
    })();

    /* `t` NO va en las dependencias a propósito: cambiar de idioma con la
       pantalla abierta volvería a lanzar esto, y con ello a gastar otra vez
       un código ya usado. El precio es que los textos de esta pantalla se
       quedan en el idioma en que se abrió, que es un mal mucho menor. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, modo]);

  const guardar = async () => {
    if (estado.fase !== "pedir-clave") return;
    if (!medirFuerza(clave).valida) {
      setFallo(enTexto(t("Esa contraseña es demasiado corta.")));
      return;
    }
    setFallo("");
    const correo = estado.correo;
    setEstado({ fase: "guardando", correo });
    try {
      await confirmPasswordReset(FirebaseAuth, codigo, clave);
      setEstado({
        fase: "listo",
        titulo: enTexto(t("Tu contraseña está lista")),
        detalle: enTexto(t("Entra con tu contraseña nueva. Después te pediremos tu clave de cifrado para abrir tus chats.")),
      });
    } catch {
      /* Se vuelve al formulario, no a la pantalla de enlace roto: lo más
         probable es que la contraseña no le gustara a Firebase, no que el
         código haya vencido en los diez segundos que lleva escribiendo. */
      setEstado({ fase: "pedir-clave", correo });
      setFallo(enTexto(t("No se pudo guardar. Prueba con otra contraseña o pide un enlace nuevo.")));
    }
  };

  const irAEntrar = () => {
    /* `continueUrl` solo se respeta si es de este mismo sitio. Es un
       parámetro que viene en la URL, así que cualquiera puede escribir el que
       quiera y mandar a un usuario recién autenticado a donde le apetezca. */
    if (continuar) {
      try {
        const destino = new URL(continuar, window.location.origin);
        if (destino.origin === window.location.origin) {
          router.push(destino.pathname + destino.search);
          return;
        }
      } catch {
        /* URL ilegible: se ignora y se va a la entrada de siempre. */
      }
    }
    router.push("/login");
  };

  const cuerpo = () => {
    switch (estado.fase) {
      case "comprobando":
        return (
          <p style={{ margin: 0, fontSize: 15.5, color: "var(--slate-700)" }}>
            {t("Comprobando el enlace…")}
          </p>
        );

      case "enlace-malo":
        return (
          <>
            <h1 className="br-page-title">{t("Este enlace no sirve")}</h1>
            <p style={{ margin: "0 0 24px", fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>
              {estado.motivo}
            </p>
            <button
              type="button"
              className="br-btn br-btn-primary br-btn-lg br-btn-block"
              onClick={() => router.push("/recuperar")}
            >
              {t("Pedir un enlace nuevo")}
            </button>
          </>
        );

      case "listo":
        return (
          <>
            <h1 className="br-page-title">{estado.titulo}</h1>
            <p style={{ margin: "0 0 24px", fontSize: 15.5, lineHeight: 1.55, color: "var(--slate-700)" }}>
              {estado.detalle}
            </p>
            <button type="button" className="br-btn br-btn-primary br-btn-lg br-btn-block" onClick={irAEntrar}>
              {t("Entrar")}
            </button>
          </>
        );

      case "pedir-clave":
      case "guardando": {
        const ocupado = estado.fase === "guardando";
        return (
          <>
            <h1 className="br-page-title">{t("Crea una contraseña nueva")}</h1>
            <p style={{ margin: "0 0 22px", fontSize: 15.5, color: "var(--slate-700)" }}>
              {/* A qué cuenta: quien tiene dos necesita saber cuál cambia. */}
              {enTexto(t("Para {{correo}}", { correo: estado.correo }))}
            </p>

            <label className="br-label">{t("Contraseña nueva")}</label>
            <div style={{ position: "relative", marginBottom: 4 }}>
              <input
                className="br-input"
                type={verla ? "text" : "password"}
                autoFocus
                autoComplete="new-password"
                disabled={ocupado}
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                  setFallo("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardar();
                }}
                style={{ width: "100%", paddingRight: 52, borderColor: fallo ? "var(--aviso-borde)" : undefined }}
              />
              {/* Ver la contraseña en vez de pedir que se repita: repetirla a
                  ciegas solo comprueba que se tecleó dos veces igual. */}
              <button
                type="button"
                aria-label={enTexto(t(verla ? "Ocultar contraseña" : "Ver contraseña"))}
                onClick={() => setVerla((v) => !v)}
                style={{
                  position: "absolute",
                  right: 2,
                  top: "50%",
                  transform: "translateY(-50%)",
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
            </div>

            <MedidorDeClave clave={clave} />

            {fallo && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--aviso-texto)" }}>{fallo}</p>
            )}

            {/* La distinción, ANTES de guardar. Ver la nota de arriba. */}
            <div
              style={{
                margin: "18px 0 22px",
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--paper-100)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--slate-700)" }}>
                {t("Esto cambia la contraseña de acceso. Tu clave de cifrado sigue igual y la pediremos al entrar.")}
              </span>
            </div>

            <button
              type="button"
              className="br-btn br-btn-primary br-btn-lg br-btn-block"
              disabled={ocupado || !clave}
              onClick={guardar}
              style={{ opacity: ocupado || !clave ? 0.5 : 1 }}
            >
              {ocupado ? t("Guardando…") : t("Guardar y entrar")}
            </button>
          </>
        );
      }
    }
  };

  return (
    <div className="br-root br-split">
      {/* La misma columna que «¿olvidaste tu contraseña?» (7f): es la
          continuación de ese recorrido y conviene que se note. */}
      <aside className="br-aside br-solo-escritorio" style={{ borderLeft: "none", borderRight: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 400, margin: "0 auto" }}>
          <Logo onClick={() => router.push("/")} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <img src="/redesign/multiple-versions-of-a-chat.svg" alt="" style={{ width: "70%", maxHeight: 280, objectFit: "contain", display: "block", margin: "0 auto" }} />
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 22, lineHeight: 1.3, color: "var(--ink-900)" }}>
            {t("Tus chats siguen a salvo mientras recuperas el acceso.")}
          </p>
        </div>
      </aside>

      <div className="br-split-main br-movil-alto">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          <div className="br-solo-movil" style={{ marginBottom: 18 }}>
            <Logo onClick={() => router.push("/")} />
          </div>
          {cuerpo()}
        </div>
      </div>
    </div>
  );
};

export default AccionCorreoScreen;
