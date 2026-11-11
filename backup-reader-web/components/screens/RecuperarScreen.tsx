import { FC, useContext, useEffect, useState } from "react";
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

  return (
    <div className="br-root br-split">
      <div className="br-split-main">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          {!enviado ? (
            <>
              <h1 className="br-page-title">{t("¿Olvidaste tu contraseña?")}</h1>
              <p style={{ margin: "0 0 22px", fontSize: 15.5, color: "var(--slate-700)" }}>
                {t("Escribe tu correo y te enviamos un enlace para crear una nueva.")}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label className="br-label">{t("Correo electrónico")}</label>
                <input
                  className="br-input"
                  type="email"
                  autoFocus
                  value={correo}
                  placeholder={enTexto(t("tucorreo@email.com"))}
                  onChange={(e) => {
                    setCorreo(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enviar();
                  }}
                  style={{ width: "100%", height: 52, borderColor: error ? "var(--aviso-borde)" : undefined }}
                />
                {error && (
                  <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "var(--aviso-texto)" }}>
                    {error}
                  </span>
                )}
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  marginBottom: 20,
                  borderRadius: 8,
                  background: "var(--paper-100)",
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 13.5, color: "var(--slate-700)", lineHeight: 1.5 }}>
                  {t("¿Entraste con Apple o Google? No tienes contraseña aquí; vuelve y usa ese botón.")}
                </span>
              </div>

              <button
                type="button"
                onClick={enviar}
                className="br-btn br-btn-primary br-btn-lg"
                style={{ width: "100%", minHeight: 52, cursor: "pointer" }}
              >
                {t("Enviar enlace")}
              </button>
            </>
          ) : (
            <>
              <h1 className="br-page-title">{t("Revisa tu correo")}</h1>
              <p style={{ margin: "0 0 22px", fontSize: 15.5, color: "var(--slate-700)", lineHeight: 1.55 }}>
                {enTexto(
                  t(
                    "Si {{correo}} tiene una cuenta, te llegará un enlace en unos minutos. Vence en 30 minutos.",
                    { correo: correo.trim() }
                  )
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  /* Reenviar tiene que REENVIAR. Antes solo reiniciaba la
                     cuenta atras, asi que quien no recibia el correo podia
                     pulsar el boton una y otra vez sin que saliera ninguno. */
                  resetPassword(correo.trim());
                  setRestan(ESPERA);
                }}
                disabled={restan > 0}
                className="br-btn br-btn-ghost"
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 10,
                  cursor: restan > 0 ? "default" : "pointer",
                  opacity: restan > 0 ? 0.5 : 1,
                }}
              >
                {restan > 0
                  ? enTexto(t("Reenviar en {{reloj}}", { reloj }))
                  : t("Reenviar enlace")}
              </button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                style={{
                  marginTop: 14,
                  width: "100%",
                  minHeight: 44,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14.5,
                  color: "var(--brass-600)",
                }}
              >
                {t("Volver a entrar")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecuperarScreen;
