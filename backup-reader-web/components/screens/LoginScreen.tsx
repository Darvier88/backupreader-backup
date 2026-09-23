import { FC, useContext, useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "../../hooks";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context";

/* ============================================================================
   Iniciar sesión — mismo diseño "Expediente" que Crear cuenta.
   Conserva la lógica de Firebase: signIn, signInGoogle, formState/validación.
   ============================================================================ */

const asideItems = (t: (k: string) => string) => [
  { img: "/redesign/review-photos-text-of-a-whatsapp-conversation.svg", title: t("Texto, fotos, videos, audios y links"), text: t("Evita los dolores de cabeza que puede llegar a ser el recuperar viejas fotos, videos o información importante.") },
  { img: "/redesign/free-space-from-your-phone.svg", title: t("Libera espacio en tu teléfono"), text: t("Al respaldar en la nube, puedes borrar chats de tu teléfono sin miedo a perder información importante.") },
  { img: "/redesign/multiple-versions-of-a-chat.svg", title: t("Múltiples Versiones"), text: t("Guarda los chats de una misma persona las veces que quieras, ordenados por fecha.") },
];

export const LoginScreen: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signInGoogle } = useContext(AuthContext);
  const { formState, setFormState } = useForm({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);

  const onHandleSignIn = async () => {
    const { email, password } = formState;
    signIn(email, password);
  };

  const validateEmail = (value: string) =>
    value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}$/i)?.input === formState.email;

  const isValidForm = () => {
    const { email, password } = formState;
    if (!validateEmail(email)) return true;
    if (password.length <= 5 || password.length >= 9) return true;
    return false;
  };

  return (
    <div className="br-root br-split">
      {/* Formulario */}
      <div className="br-split-main">
        <div className="br-split-inner" style={{ maxWidth: 420 }}>
          <h1 className="br-page-title">{t("Iniciar sesión")}</h1>
          <p style={{ margin: "0 0 6px", fontSize: 15.5, color: "var(--slate-700)" }}>
            {t("¿No tienes cuenta?")} <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/auth")}>{t("Crear cuenta")}</span>
          </p>
          <p style={{ margin: "0 0 28px", fontSize: 15.5 }}>
            <span className="br-link" style={{ cursor: "pointer" }} onClick={signInGoogle}>{t("Iniciar con Google")}</span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="br-field">
              <label className="br-label">{t("Correo")}</label>
              <input className="br-input" type="email" placeholder={t("tucorreo@email.com")} onChange={(e) => setFormState("email", e.target.value)} />
            </div>
            <div className="br-field" style={{ position: "relative" }}>
              <label className="br-label">{t("Contraseña")}</label>
              <input className="br-input" type={showPw ? "text" : "password"} placeholder={t("Tu contraseña")} onChange={(e) => setFormState("password", e.target.value)} />
              <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, bottom: 11, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brass-600)" }}>
                {showPw ? t("Ocultar") : t("Mostrar")}
              </button>
            </div>

            <button className="br-btn br-btn-primary br-btn-lg br-btn-block" style={{ marginTop: 6, opacity: isValidForm() ? 0.5 : 1, cursor: isValidForm() ? "not-allowed" : "pointer" }} disabled={isValidForm()} onClick={onHandleSignIn}>
              {t("Iniciar sesión")}
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
