import { FC, useContext, useEffect, useState } from "react";
import { BotonAtras, IconoPaso } from "../ui/Paso";
import { Logo } from "../ui/BrandChrome";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { AuthContext } from "../../context";

/**
 * Recuperar la contraseña de la cuenta (pantallas 5d y 5e).
 *
 * NO DICE SI EL CORREO EXISTE
 * ---------------------------
 * El mensaje es "si ana@correo.com tiene una cuenta, te llegará un enlace", y
 * sale igual exista o no. Si dijera "ese correo no está registrado", esta
 * pantalla se convertiría en una forma de averiguar quién tiene cuenta aquí:
 * se prueban correos y se mira la respuesta. Saber que alguien guarda sus
 * conversaciones en un sitio así ya es información sobre esa persona.
 *
 * (Nota de coherencia: la pantalla 4b sí dice si el correo es nuevo, porque
 * allí hace falta para decidir si pedir el nombre. Son dos criterios
 * distintos para lo mismo, y conviene decidir cuál vale. Queda anotado.)
 *
 * QUIEN ENTRÓ CON APPLE O GOOGLE NO TIENE CONTRASEÑA
 * --------------------------------------------------
 * Se dice antes de enviar nada. Esa persona puede pasarse un buen rato
 * esperando un correo que nunca llega, porque en su cuenta no hay contraseña
 * que restablecer; el problema no es que se haya perdido, es que nunca existió.
 *
 * EL REENVÍO ESPERA
 * -----------------
 * Un botón de reenviar sin cuenta atrás se pulsa tres veces en diez segundos,
 * y entonces llegan tres correos con tres enlaces donde solo el último vale.
 * Quien abra el primero verá que no funciona.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

const correoValido = (valor: string) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i.test(valor.trim());

/** Segundos de espera antes de poder reenviar. */
const ESPERA = 45;

export const RecuperarScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { resetPassword } = useContext(AuthContext);

  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [restan, setRestan] = useState(0);
  /* «Abrir app de correo» solo en iPhone/iPad: `message:` abre Mail en iOS y
     en el resto (Android, escritorio) el navegador no hace nada con él. Un
     botón principal que no responde es peor que no tenerlo. Se calcula tras
     montar para que servidor y cliente pinten lo mismo. */
  const [esIOS, setEsIOS] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const iPadComoMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    setEsIOS(/iPhone|iPad|iPod/.test(ua) || iPadComoMac);
  }, []);

  useEffect(() => {
    if (restan <= 0) return;
    const id = setTimeout(() => setRestan((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restan]);

  const enviar = () => {
    const valor = correo.trim();
    if (!correoValido(valor)) {
      setError(enTexto(t("Escribe un correo válido.")));
      return;
    }
    setError("");
    resetPassword(valor);
    setEnviado(true);
    setRestan(ESPERA);
  };

  const reloj = `${Math.floor(restan / 60)}:${String(restan % 60).padStart(2, "0")}`;

  const volver = () => router.push("/login");

  return (
    <div className="br-root br-split">
      {/* Columna izquierda (7f): logo, la lámina y una sola frase abajo.
          Quien no puede entrar teme antes que nada haber perdido sus chats;
          decirlo aquí quita ese miedo mientras rellena el formulario. */}
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
          {/* Flecha de atrás en móvil (5d, 5e). */}
          <div className="br-cabecera-paso br-solo-movil-flex">
            <BotonAtras etiqueta={enTexto(t("Atrás"))} onClick={() => (enviado ? setEnviado(false) : volver())} />
          </div>

          {!enviado ? (
            <>
              <h1 className="br-page-title">{t("¿Olvidaste tu contraseña?")}</h1>
              <p style={{ margin: "0 0 22px", fontSize: 15.5, color: "var(--slate-700)" }}>
                {t("Escribe tu correo y te enviamos un enlace para crear una nueva.")}
              </p>

              <div style={{ marginBottom: 14 }}>
                <label className="br-label">{t("Correo")}</label>
                <input
                  className="br-input"
                  type="email"
                  autoFocus
                  value={correo}
                  placeholder={enTexto(t("tucorreo@ejemplo.com"))}
                  onChange={(e) => {
                    setCorreo(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enviar();
                  }}
                  style={{ width: "100%", height: 48, borderColor: error ? "var(--aviso-borde)" : undefined }}
                />
                {error && (
                  <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "var(--aviso-texto)" }}>
                    {error}
                  </span>
                )}
              </div>

              {/* Texto suelto y pequeño, no una caja (5d): es una aclaración. */}
              <p style={{ margin: 0, fontSize: 13, color: "var(--slate-500)", lineHeight: 1.5 }}>
                {t("¿Entraste con Apple o Google? No tienes contraseña aquí; vuelve y usa ese botón.")}{" "}
                <span className="br-link br-solo-escritorio-inline" style={{ cursor: "pointer" }} onClick={volver}>
                  {t("Volver")}
                </span>
              </p>

              <div className="br-movil-abajo">
                <button
                  type="button"
                  onClick={enviar}
                  className="br-btn br-btn-primary br-btn-lg"
                  style={{ width: "100%", minHeight: 52, cursor: "pointer" }}
                >
                  {t("Enviar enlace")}
                </button>
              </div>
            </>
          ) : (
            <>
              <IconoPaso tipo="sobre" tono="suave" />
              <h1 className="br-page-title" style={{ marginTop: 24 }}>{t("Revisa tu correo")}</h1>
              <p style={{ margin: 0, fontSize: 15.5, color: "var(--slate-700)", lineHeight: 1.55 }}>
                {enTexto(
                  t(
                    "Si {{correo}} tiene una cuenta, te llegará un enlace en unos minutos. Vence en una hora.",
                    { correo: correo.trim() }
                  )
                )}
              </p>

              <div className="br-movil-abajo" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Abrir el correo (5e), con borde: es una ayuda, no la
                    acción principal. Solo en iPhone/iPad, donde `message:`
                    abre Mail; en el resto no haría nada. */}
                {esIOS && (
                  <a
                    href="message:"
                    className="br-btn br-btn-ghost br-btn-lg"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 52, textDecoration: "none", borderColor: "var(--ink-900)" }}
                  >
                    {t("Abrir app de correo")}
                  </a>
                )}

                {/* «Reenviar en 0:42» como texto mientras corre la espera, y
                    enlace cuando ya se puede (5e). Reenviar REENVÍA. */}
                {restan > 0 ? (
                  <div style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--slate-500)" }}>
                    {t("Reenviar en")}
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)", paddingLeft: 6 }}>{reloj}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      resetPassword(correo.trim());
                      setRestan(ESPERA);
                    }}
                    style={{ minHeight: 44, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--brass-600)" }}
                  >
                    {t("Reenviar enlace")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecuperarScreen;
