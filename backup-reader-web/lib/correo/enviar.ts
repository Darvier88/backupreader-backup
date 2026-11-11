/**
 * Mandar un correo desde el servidor.
 *
 * POR QUÉ NO USAMOS EL CORREO DE FIREBASE
 * ---------------------------------------
 * Firebase manda sus propios correos, pero su plantilla no se puede editar en
 * este proyecto: la consola responde `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, un
 * bloqueo del lado de Google que no depende de nada que hagamos aquí. Eso
 * dejaba tres cosas fuera de nuestro alcance: el enlace apuntaba a una página
 * alojada por Google con otra tipografía y otro nombre, el asunto y el texto
 * estaban en inglés para todo el mundo, y el remitente era una dirección
 * `@backup-reader.firebaseapp.com` que en una bandeja de entrada se lee como
 * un intento de phishing.
 *
 * SIN DEPENDENCIAS NUEVAS
 * -----------------------
 * Se habla con la API del proveedor por HTTP y ya está. Una librería para
 * hacer un POST añade un paquete que mantener, y el día que se cambie de
 * proveedor habría que cambiar la librería además del código.
 *
 * SI NO ESTÁ CONFIGURADO, NO FALLA
 * --------------------------------
 * Sin `RESEND_API_KEY` esto devuelve `sin-configurar` en vez de romperse, y
 * quien llama se repliega al correo de Firebase. Así se puede desplegar antes
 * de contratar el proveedor, y el día que falte la variable en producción lo
 * que pasa es que los correos vuelven a ser los feos, no que nadie pueda
 * recuperar su cuenta.
 */

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; motivo: "sin-configurar" | "rechazado" | "red" };

export type Correo = {
  para: string;
  asunto: string;
  html: string;
  texto: string;
};

/** ¿Hay proveedor configurado? Lo usa el endpoint para decidir si repliega. */
export function hayProveedor(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** El remitente, con un valor por defecto para no quedarse a medias. */
function remitente(): string {
  return process.env.CORREO_REMITENTE || "BackupReader <noreply@backupreader.com>";
}

export async function enviarCorreo(correo: Correo): Promise<ResultadoEnvio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { ok: false, motivo: "sin-configurar" };

  try {
    /* En desarrollo se puede apuntar a otro sitio para ver el correo sin
       mandarlo de verdad. En producción esta variable no existe. */
    const destino = process.env.CORREO_API_URL || "https://api.resend.com/emails";
    const r = await fetch(destino, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente(),
        to: [correo.para],
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
    });

    if (!r.ok) {
      /* El cuerpo del error se registra pero NO se devuelve a quien llama:
         acaba en una pantalla pública y puede contener detalles de la cuenta
         del proveedor. */
      const detalle = await r.text().catch(() => "");
      console.error("El proveedor rechazó el correo:", r.status, detalle.slice(0, 300));
      return { ok: false, motivo: "rechazado" };
    }

    return { ok: true };
  } catch (error) {
    console.error("No se pudo hablar con el proveedor de correo:", error);
    return { ok: false, motivo: "red" };
  }
}
