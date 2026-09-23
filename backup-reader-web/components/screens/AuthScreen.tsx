import { FC, useContext, useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "../../hooks";
import { useTranslation } from "react-i18next";
import { AuthContext, ModalContext } from "../../context";

/* ============================================================================
   Crear cuenta — rediseño "Expediente" (formulario + aside ilustrado).
   Conserva la lógica de Firebase: signUp, signInGoogle, formState/validación.
   ============================================================================ */

const serif = "var(--font-serif)";

const asideItems = (t: (k: string) => string) => [
  { img: "/redesign/review-photos-text-of-a-whatsapp-conversation.svg", title: t("Texto, fotos, videos, audios y links"), text: t("Evita los dolores de cabeza que puede llegar a ser el recuperar viejas fotos, videos o información importante.") },
  { img: "/redesign/free-space-from-your-phone.svg", title: t("Libera espacio en tu teléfono"), text: t("Al respaldar en la nube, puedes borrar chats de tu teléfono sin miedo a perder información importante.") },
  { img: "/redesign/multiple-versions-of-a-chat.svg", title: t("Múltiples Versiones"), text: t("Guarda los chats de una misma persona las veces que quieras, ordenados por fecha.") },
];

export const AuthScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { hide } = useContext(ModalContext);
  const { signUp, signInGoogle } = useContext(AuthContext);
  const { formState, setFormState } = useForm({ name: "", email: "", password: "", repeatpassword: "" });
  const [showPw, setShowPw] = useState(false);

  const onHandleSignUp = () => {
    hide();
    const { email, password } = formState;
    signUp(email, password);
  };

  const validateEmail = (value: string) =>
    value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}$/i)?.input === formState.email;

  const isValidForm = () => {
    const { name, email, password, repeatpassword } = formState;
    if (!validateEmail(email)) return true;
    if (password.length <= 5 || password.length >= 9) return true;
    if (name.length === 0) return true;
    if (repeatpassword != password) return true;
    return false;
  };

  const mismatch = formState.repeatpassword.length > 0 && formState.password !== formState.repeatpassword;

  return (
    <div className="br-root br-split">
      {/* Formulario */}
      <div className="br-split-main">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          <h1 className="br-page-title">{t("Crear cuenta")}</h1>
          <p style={{ margin: "0 0 6px", fontSize: 15.5, color: "var(--slate-700)" }}>
            {t("¿Ya tienes una?")} <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/login")}>{t("Iniciar sesión")}</span>
          </p>
          <p style={{ margin: "0 0 28px", fontSize: 15.5 }}>
            <span className="br-link" style={{ cursor: "pointer" }} onClick={signInGoogle}>{t("Regístrate con Google")}</span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="br-field">
              <label className="br-label">{t("Nombre")}</label>
              <input className="br-input" placeholder={t("Tu nombre")} onChange={(e) => setFormState("name", e.target.value)} />
            </div>
            <div className="br-field">
              <label className="br-label">{t("Correo")}</label>
              <input className="br-input" type="email" placeholder={t("tucorreo@email.com")} onChange={(e) => setFormState("email", e.target.value)} />
            </div>
            <div className="br-field" style={{ position: "relative" }}>
              <label className="br-label">{t("Contraseña")}</label>
              <input className="br-input" type={showPw ? "text" : "password"} placeholder={t("De 6 a 8 caracteres")} onChange={(e) => setFormState("password", e.target.value)} />
              <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, bottom: 11, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brass-600)" }}>
                {showPw ? t("Ocultar") : t("Mostrar")}
              </button>
            </div>
            <div className="br-field">
              <label className="br-label">{t("Repetir contraseña")}</label>
              <input className={"br-input" + (mismatch ? " br-input-invalid" : "")} type={showPw ? "text" : "password"} placeholder={t("Repite tu contraseña")} onChange={(e) => setFormState("repeatpassword", e.target.value)} />
              {mismatch && <span style={{ fontSize: 12, color: "var(--clay-600)" }}>{t("Las contraseñas no coinciden")}</span>}
            </div>

            <button className="br-btn br-btn-primary br-btn-lg br-btn-block" style={{ marginTop: 6, opacity: isValidForm() ? 0.5 : 1, cursor: isValidForm() ? "not-allowed" : "pointer" }} disabled={isValidForm()} onClick={onHandleSignUp}>
              {t("Crear cuenta")}
            </button>
          </div>

          <p className="br-fineprint" style={{ marginTop: 28 }}>
            {t("Al continuar estarás aceptando nuestra")} <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/privacyPolicy")}>{t("Política de Privacidad")}</span> {t("y")} <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/termsConditions")}>{t("Términos de Servicio")}</span>.
          </p>
        </div>
      </div>

      {/* Aside ilustrado */}
      <aside className="br-aside">
        <div className="br-aside-inner">
          {asideItems(t).map((it, i) => (
            <div key={i} className="br-aside-item">
              <img src={it.img} alt="" />
              <h2>{it.title}</h2>
              <p>{it.text}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
