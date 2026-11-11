import React, { useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { Button, Loading } from "@nextui-org/react";
import { useTranslation } from "react-i18next";

import { bytes, dinero, llamarAdmin } from "./llamarAdmin";
import type { UsuarioDeAdmin } from "../../pages/api/admin/usuarios";

/**
 * La confirmación de un borrado.
 *
 * Antes de dejar borrar, enseña lo que hay en juego: cuántos chats, cuánto
 * espacio y —esto es lo que no se puede adivinar desde la tabla— qué hay en
 * Stripe. Un usuario con suscripción viva y trescientos dólares cobrados no se
 * borra igual que una cuenta de prueba vacía, y el panel no debería hacer que
 * se parezcan.
 *
 * La confirmación es el correo escrito a mano. Un botón de "sí, borrar" no
 * distingue entre haber elegido a este usuario y haberse equivocado de fila,
 * que con una tabla de correos parecidos es el error fácil. El servidor
 * comprueba lo mismo, así que esto no es la seguridad: es que al admin le dé
 * tiempo de mirar a quién está borrando.
 */

type Props = {
  usuario: UsuarioDeAdmin;
  onCerrar: () => void;
  /** Se llama al terminar un borrado completo, para refrescar la tabla. */
  onBorrado: () => void;
};

type Detalle = {
  clientes: string[];
  suscripcionesVivas: number;
  estadoSuscripcion: string | null;
  proximoCobro: number | null;
  totalCobrado: number;
  totalDevuelto: number;
  moneda: string | null;
  cobros: number;
};

export const DialogoBorrado: React.FC<Props> = ({ usuario, onCerrar, onBorrado }) => {
  const { t } = useTranslation();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(true);
  const [errorDetalle, setErrorDetalle] = useState("");

  const [texto, setTexto] = useState("");
  const [reembolsar, setReembolsar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const esperado = (usuario.correo || usuario.uid).trim().toLowerCase();
  const coincide = texto.trim().toLowerCase() === esperado;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { datos } = await llamarAdmin("detalle", { uid: usuario.uid });
      if (!vivo) return;
      if (datos?.ok) setDetalle(datos.stripe);
      else
        setErrorDetalle(
          (t("No se pudo consultar Stripe. Puedes borrar igual, pero revisa a mano si tenía suscripción.") as string)
        );
      setCargandoDetalle(false);
    })();
    return () => {
      vivo = false;
    };
  }, [usuario.uid]);

  const borrar = async () => {
    setBorrando(true);
    const { datos } = await llamarAdmin("eliminar-usuario", {
      uid: usuario.uid,
      confirmacion: texto.trim(),
      reembolsar,
    });
    setBorrando(false);
    setResultado(datos ?? { ok: false, error: "sin-respuesta" });

    /* Solo se refresca la tabla si la cuenta se fue de verdad. Si quedó
       pendiente, el usuario sigue ahí y el admin tiene que poder volver a
       lanzarlo sobre la misma fila. */
    if (datos?.ok && !datos?.pendiente) onBorrado();
  };

  /* --- Ya se ejecutó: se enseña paso por paso --- */
  if (resultado) {
    const p = resultado.pasos ?? {};
    return (
      <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
        <DialogTitle>
          {resultado.ok && !resultado.pendiente
            ? t("Cuenta borrada")
            : resultado.pendiente
            ? t("Borrado a medio terminar")
            : t("El borrado falló")}
        </DialogTitle>
        <DialogContent>
          <Typography fontSize={14} sx={{ marginBottom: 1 }}>
            {usuario.correo || usuario.uid}
          </Typography>

          {resultado.aviso && (
            <Typography fontSize={14} sx={{ color: "var(--aviso-texto)", marginBottom: 2 }}>
              {resultado.aviso}
            </Typography>
          )}

          <Box component="ul" sx={{ paddingLeft: 2.5, margin: 0, fontSize: 14 }}>
            {p.stripe && (
              <>
                <li>
                  {t("Stripe: {{subs}} suscripción(es) cancelada(s), {{clientes}} cliente(s) borrado(s)", {
                    subs: p.stripe.suscripcionesCanceladas,
                    clientes: p.stripe.clientesBorrados,
                  })}
                </li>
                {p.stripe.devoluciones?.length > 0 && (
                  <li>
                    {t("Devoluciones: {{hechas}} hechas, {{fallidas}} fallidas", {
                      hechas: p.stripe.devoluciones.filter((d: any) => d.ok).length,
                      fallidas: p.stripe.devoluciones.filter((d: any) => !d.ok).length,
                    })}
                  </li>
                )}
                {p.stripe.cobrosQueQuedan > 0 && (
                  <li>
                    {t("Cobrado y NO devuelto")}:{" "}
                    {dinero(p.stripe.cobrosQueQuedan, detalle?.moneda ?? null)}
                  </li>
                )}
                {p.stripe.aviso && (
                  <li style={{ color: "var(--aviso-texto)" }}>{p.stripe.aviso}</li>
                )}
              </>
            )}
            {p.stripeOmitido && (
              <li style={{ color: "var(--aviso-texto)" }}>{p.stripeOmitido}</li>
            )}
            {p.storage && (
              <li>
                {t("Storage: {{n}} archivos borrados", { n: p.storage.borrados })}
                {p.storage.fallidos > 0 && `, ${p.storage.fallidos} fallidos`}
                {p.storage.quedan > 0 && `, ${p.storage.quedan} pendientes`}
              </li>
            )}
            {p.firestore && (
              <li>
                {t("Firestore: {{n}} metadatos de chats, bóveda, estado y perfil", {
                  n: p.firestore.backups,
                })}
              </li>
            )}
            {p.auth && <li>{t("Cuenta de acceso borrada")}</li>}
          </Box>

          <Typography fontSize={13} sx={{ color: "#6B6B6B", marginTop: 2 }}>
            {t("Los cobros ya hechos siguen en Stripe: no se pueden borrar, son el registro contable de un dinero que se movió.")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button auto light onPress={onCerrar}>
            {t("Cerrar")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  /* --- Antes de ejecutar --- */
  return (
    <Dialog open onClose={borrando ? undefined : onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>{t("Borrar esta cuenta")}</DialogTitle>
      <DialogContent>
        <Typography fontSize={15} fontWeight={600}>
          {usuario.correo || t("(sin correo)")}
        </Typography>
        <Typography fontSize={13} sx={{ color: "#6B6B6B", wordBreak: "break-all" }}>
          {usuario.uid}
        </Typography>

        <Box sx={{ marginTop: 2, fontSize: 14 }}>
          <div>
            {t("{{n}} chat(s) · {{tam}} cifrados", { n: usuario.chats, tam: bytes(usuario.bytesCifrados) })}
          </div>
          <div>{t("Plan")}: {usuario.plan || t("ninguno")}</div>
        </Box>

        <Box
          sx={{
            marginTop: 2,
            padding: "10px 12px",
            background: "#F6F7F9",
            borderRadius: 1,
            fontSize: 14,
          }}
        >
          {cargandoDetalle && <Loading size="sm" />}
          {!cargandoDetalle && errorDetalle && (
            <span style={{ color: "var(--aviso-texto)" }}>{errorDetalle}</span>
          )}
          {!cargandoDetalle && detalle && (
            <>
              <div>
                Stripe:{" "}
                {detalle.clientes.length === 0
                  ? t("sin cliente")
                  : (t("{{n}} cliente(s)", { n: detalle.clientes.length }) as string)}
              </div>
              <div>
                {t("Suscripción")}:{" "}
                {detalle.suscripcionesVivas === 0
                  ? t("ninguna viva")
                  : `${detalle.estadoSuscripcion}`}
              </div>
              <div>
                {t("Cobrado")}: {dinero(detalle.totalCobrado, detalle.moneda)} {t("en")}{" "}
                {t("{{n}} cobro(s)", { n: detalle.cobros })}
                {detalle.totalDevuelto > 0 &&
                  ` · ${t("devuelto")} ${dinero(detalle.totalDevuelto, detalle.moneda)}`}
              </div>
            </>
          )}
        </Box>

        <Typography fontSize={14} sx={{ marginTop: 2, color: "var(--aviso-texto)" }}>
          {t("Esto no se puede deshacer. Los chats están cifrados con una clave que solo existe dentro de la bóveda de este usuario: al borrarla, los archivos quedan ilegibles para siempre, también para ti.")}
        </Typography>

        {detalle && detalle.totalCobrado - detalle.totalDevuelto > 0 && (
          <FormControlLabel
            sx={{ marginTop: 1 }}
            control={
              <Checkbox
                checked={reembolsar}
                onChange={(e) => setReembolsar(e.target.checked)}
              />
            }
            label={
              <span style={{ fontSize: 14 }}>
                {t("Devolverle {{importe}} (opcional, y aparte del borrado)", {
                  importe: dinero(
                    detalle.totalCobrado - detalle.totalDevuelto,
                    detalle.moneda
                  ),
                })}
              </span>
            }
          />
        )}

        <Typography fontSize={14} sx={{ marginTop: 2 }}>
          {t("Escribe")} <strong>{esperado}</strong> {t("para confirmar")}:
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          sx={{ marginTop: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button auto light onPress={onCerrar} disabled={borrando}>
          {t("Cancelar")}
        </Button>
        <Button
          auto
          color="error"
          onPress={borrar}
          disabled={!coincide || borrando}
        >
          {borrando ? <Loading size="sm" color="white" /> : t("Borrar para siempre")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
