/**
 * El correo de «recupera tu contraseña»: el enlace y el texto.
 *
 * Esto es una librería pura, sin Firebase ni red, para poder probarla. Quien
 * genera el enlace de verdad es el endpoint; aquí solo se decide a dónde
 * apunta y qué dice.
 */

export type Idioma = "es" | "en";

/**
 * Convierte el enlace que da Firebase en uno que apunta a nuestra pantalla.
 *
 * `generatePasswordResetLink` devuelve algo como
 *
 *   https://backup-reader.firebaseapp.com/__/auth/action?mode=resetPassword
 *     &oobCode=ABC&apiKey=XYZ&lang=en
 *
 * Lo único que importa de ahí es el `oobCode`: es el permiso de un solo uso
 * para cambiar esa contraseña, y vale igual se abra donde se abra. Así que se
 * extrae y se cuelga de nuestra propia dirección.
 *
 * ESTO ES LO QUE EVITA EL BLOQUEO DE LA CONSOLA
 * ---------------------------------------------
 * La consola de Firebase no deja cambiar la URL de acción en este proyecto
 * (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`). Pero esa URL solo decide a dónde
 * apuntan los correos que manda GOOGLE. Si el correo lo mandamos nosotros, el
 * enlace lo escribimos nosotros, y no hace falta permiso de nadie.
 *
 * `apiKey` y `lang` se dejan fuera: la pantalla no los usa, y una URL con
 * menos cosas es una URL con menos cosas que puedan ir mal al copiarla.
 */
export function enlaceDeRecuperacion(enlaceDeFirebase: string, base: string): string | null {
  let codigo: string | null = null;
  try {
    codigo = new URL(enlaceDeFirebase).searchParams.get("oobCode");
  } catch {
    return null;
  }
  if (!codigo) return null;

  /* La base sin barra final, para no acabar con `//accion`. Funciona igual,
     pero sale en el correo y se ve descuidado. */
  const raiz = (base || "").replace(/\/+$/, "");
  if (!raiz) return null;

  return `${raiz}/accion?mode=resetPassword&oobCode=${encodeURIComponent(codigo)}`;
}

const textos = {
  es: {
    asunto: "Recupera tu contraseña de BackupReader",
    saludo: "Hola,",
    cuerpo:
      "Pediste recuperar la contraseña de tu cuenta de BackupReader. Pulsa el botón y podrás crear una nueva.",
    boton: "Crear una contraseña nueva",
    vence: "El enlace vence en una hora y solo se puede usar una vez.",
    ojo:
      "Esto cambia la contraseña con la que entras. Tu clave de cifrado es otra y no cambia: la pediremos al entrar, como siempre.",
    noFuiste:
      "Si no pediste esto, puedes ignorar este correo. Tu contraseña no cambia hasta que alguien abra el enlace y escriba una nueva.",
    firma: "El equipo de BackupReader",
    siNoVa: "Si el botón no funciona, copia esta dirección en tu navegador:",
  },
  en: {
    asunto: "Reset your BackupReader password",
    saludo: "Hi,",
    cuerpo:
      "You asked to reset the password for your BackupReader account. Press the button and you'll be able to create a new one.",
    boton: "Create a new password",
    vence: "The link expires in one hour and can only be used once.",
    ojo:
      "This changes the password you sign in with. Your encryption key is a different one and does not change: we'll ask for it when you sign in, as always.",
    noFuiste:
      "If you didn't ask for this, you can ignore this email. Your password doesn't change until someone opens the link and types a new one.",
    firma: "The BackupReader team",
    siNoVa: "If the button doesn't work, copy this address into your browser:",
  },
} as const;

function escapar(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * El correo entero.
 *
 * Los estilos van en línea porque los clientes de correo descartan las hojas
 * de estilo, y los colores van escritos a mano y no como variables CSS por lo
 * mismo. Es la única parte del proyecto donde eso es correcto.
 */
export function correoDeRecuperacion(enlace: string, idioma: Idioma = "es") {
  const t = textos[idioma] || textos.es;
  const seguro = escapar(enlace);

  const html = `<!doctype html>
<html lang="${idioma}">
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFDFA;border:1px solid #E7E2DA;border-radius:14px;">
          <tr><td style="padding:28px 28px 0;">
            <span style="font-size:19px;font-weight:600;color:#16233B;">Backup<span style="color:#6B7A90;font-weight:500;">Reader</span></span>
          </td></tr>
          <tr><td style="padding:22px 28px 0;">
            <p style="margin:0 0 14px;font-size:15.5px;line-height:1.55;color:#3C4659;">${t.saludo}</p>
            <p style="margin:0 0 22px;font-size:15.5px;line-height:1.55;color:#3C4659;">${t.cuerpo}</p>
            <a href="${seguro}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#16233B;color:#FFFDFA;font-size:15.5px;font-weight:600;text-decoration:none;">${t.boton}</a>
            <p style="margin:18px 0 0;font-size:13.5px;line-height:1.5;color:#6B7A90;">${t.vence}</p>
          </td></tr>
          <tr><td style="padding:20px 28px 0;">
            <div style="padding:12px 14px;border-radius:10px;background:#F3EFE8;border:1px solid #E7E2DA;">
              <span style="font-size:13.5px;line-height:1.5;color:#3C4659;">${t.ojo}</span>
            </div>
          </td></tr>
          <tr><td style="padding:20px 28px 0;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7A90;">${t.noFuiste}</p>
          </td></tr>
          <tr><td style="padding:18px 28px 26px;">
            <p style="margin:0 0 6px;font-size:12px;color:#6B7A90;">${t.siNoVa}</p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#6B7A90;word-break:break-all;">${seguro}</p>
            <p style="margin:18px 0 0;font-size:13px;color:#6B7A90;">${t.firma}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  /* La versión en texto no es un adorno: hay clientes que no pintan HTML, y
     un correo que solo trae HTML puntúa peor en los filtros de spam, que es
     el último sitio donde quieres que acabe esto. */
  const texto = [
    t.saludo,
    "",
    t.cuerpo,
    "",
    enlace,
    "",
    t.vence,
    "",
    t.ojo,
    "",
    t.noFuiste,
    "",
    t.firma,
  ].join("\n");

  return { asunto: t.asunto, html, texto };
}
