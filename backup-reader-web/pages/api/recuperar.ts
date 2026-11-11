import type { NextApiRequest, NextApiResponse } from "next";

import { authAdmin } from "../../lib/admin-servidor";
import { RECUPERAR_CONTRASENA } from "../../lib/funciones-activas";
import { enviarCorreo, hayProveedor } from "../../lib/correo/enviar";
import { correoDeRecuperacion, enlaceDeRecuperacion, type Idioma } from "../../lib/correo/recuperacion";

/**
 * Mandar el correo de «recupera tu contraseña», desde aquí y no desde Google.
 *
 * POR QUÉ EXISTE ESTE ENDPOINT
 * ----------------------------
 * La consola de Firebase no deja cambiar la URL de acción en este proyecto:
 * responde `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, un bloqueo de Google que no
 * depende de nada de aquí. Mientras los correos los mande Firebase, el enlace
 * seguirá llevando a una página alojada por Google y el texto seguirá en
 * inglés para todo el mundo.
 *
 * Pero ese ajuste solo decide a dónde apuntan los correos que manda GOOGLE. El
 * Admin SDK genera el mismo `oobCode` sin pedirle permiso a la consola, así
 * que aquí se genera, se cuelga de nuestra propia pantalla y se manda con
 * nuestro proveedor. El bloqueo deja de importar.
 *
 * SIEMPRE CONTESTA QUE SÍ
 * -----------------------
 * Exista el correo o no, falle el envío o no, la respuesta es la misma. Si
 * distinguiera, este endpoint sería una forma de averiguar quién tiene cuenta
 * aquí: se prueban direcciones y se mira la respuesta. Saber que alguien
 * guarda sus conversaciones en un sitio así ya es información sobre esa
 * persona. La pantalla 5e ya enseña el mismo mensaje por el mismo motivo; de
 * nada serviría si el endpoint de debajo cantara la verdad.
 *
 * SE PUEDE REPLEGAR
 * -----------------
 * Si no hay proveedor configurado, contesta `repliega: true` y el navegador
 * manda el correo por Firebase como siempre. Así esto se puede desplegar
 * antes de contratar nada, y el día que falte la variable en producción los
 * correos vuelven a ser los de Google en vez de no llegar ninguno.
 */

/** Cuántas peticiones se admiten por dirección y por rato. */
const TOPE = 3;
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Freno por dirección de correo, en memoria.
 *
 * Es un freno de verdad para el caso normal —alguien, o algo, aporreando el
 * formulario— pero hay que saber qué NO es: vive en la memoria de cada
 * instancia, así que ni se comparte entre las instancias de Vercel ni
 * sobrevive a un despliegue. Para un tope duro haría falta Firestore o Redis,
 * y para lo que cuesta aquí no compensa todavía. Queda anotado.
 */
const vistos = new Map<string, number[]>();

function demasiadas(correo: string): boolean {
  const ahora = Date.now();
  const previas = (vistos.get(correo) || []).filter((t) => ahora - t < VENTANA_MS);
  previas.push(ahora);
  vistos.set(correo, previas);

  /* Limpieza para que el Map no crezca sin fin en una instancia de larga
     vida. Barato: solo se mira cuando ya hay bastantes entradas. */
  if (vistos.size > 500) {
    for (const [clave, marcas] of vistos) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) vistos.delete(clave);
    }
  }

  return previas.length > TOPE;
}

const correoValido = (valor: string) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i.test(valor);

/** De dónde cuelga el enlace. En producción, el dominio real. */
function base(req: NextApiRequest): string {
  if (process.env.NEXT_PUBLIC_URL_BASE) return process.env.NEXT_PUBLIC_URL_BASE;
  /* Vercel la da hecha en cada despliegue, incluidas las vistas previas, que
     es justo donde hace falta para probar sin tocar nada. */
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host || "";
  if (!host) return "";
  const esquema = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${esquema}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  /* El interruptor también cierra la puerta de atrás.
     Esconder el enlace y redirigir las rutas no sirve de nada si el endpoint
     sigue abierto: cualquiera con `curl` podría seguir disparando correos de
     recuperación a direcciones ajenas. */
  if (!RECUPERAR_CONTRASENA) {
    return res.status(404).json({ ok: false, motivo: "desactivado" });
  }

  const correo = String(req.body?.correo || "").trim().toLowerCase();
  const idioma: Idioma = String(req.body?.idioma || "es").startsWith("en") ? "en" : "es";

  /* Un correo con mala forma sí se rechaza: eso no revela nada de nadie, y
     deja claro al formulario que no lo intente. */
  if (!correoValido(correo)) {
    return res.status(400).json({ ok: false, motivo: "correo-invalido" });
  }

  if (!hayProveedor()) {
    return res.status(200).json({ ok: true, repliega: true });
  }

  /* A partir de aquí la respuesta es la misma pase lo que pase. Ver arriba. */
  const comoSiNada = () => res.status(200).json({ ok: true });

  if (demasiadas(correo)) return comoSiNada();

  const raiz = base(req);
  if (!raiz) {
    console.error("No se pudo deducir la dirección del sitio para el enlace de recuperación.");
    return res.status(200).json({ ok: true, repliega: true });
  }

  try {
    const admin = authAdmin();
    /* Esto lanza si el correo no tiene cuenta, que es lo normal cuando alguien
       se equivoca al escribirlo. No es un error que haya que contar. */
    const deFirebase = await admin.generatePasswordResetLink(correo);
    const enlace = enlaceDeRecuperacion(deFirebase, raiz);
    if (!enlace) {
      console.error("El enlace de Firebase no traía oobCode.");
      return comoSiNada();
    }

    const { asunto, html, texto } = correoDeRecuperacion(enlace, idioma);
    const envio = await enviarCorreo({ para: correo, asunto, html, texto });
    if (!envio.ok) {
      /* El usuario no se entera, pero nosotros sí: sin este registro, un
         proveedor caído se ve exactamente igual que un correo que no existe,
         y nadie se enteraría hasta recibir quejas. */
      console.error("No se pudo enviar el correo de recuperación:", envio.motivo);
    }
    return comoSiNada();
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") {
      console.error("Fallo generando el enlace de recuperación:", error?.code || error);
    }
    return comoSiNada();
  }
}
