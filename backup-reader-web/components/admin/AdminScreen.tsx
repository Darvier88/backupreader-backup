import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, TextField, Typography, useMediaQuery } from "@mui/material";
import { Button, Loading } from "@nextui-org/react";

import { FirebaseAuth } from "../../config/firebase";
import { bytes, fecha, llamarAdmin } from "./llamarAdmin";
import { DialogoBorrado } from "./DialogoBorrado";
import type { UsuarioDeAdmin } from "../../pages/api/admin/usuarios";

/**
 * El panel de administración.
 *
 * NO está en el menú a propósito: se llega escribiendo /admin. No es seguridad
 * —quien sepa la ruta llega igual, y el permiso de verdad lo comprueban los
 * endpoints— pero evita que un enlace visible invite a cualquiera a probar.
 *
 * Tampoco está traducido. Lo usa una persona que sabe español y meter sesenta
 * claves de i18n para una pantalla interna solo añade sitios donde fallar.
 *
 * Quién manda es el servidor. Esta pantalla pregunta a `sesion` si quien mira
 * es admin solo para decidir qué pintar: falsear esa respuesta en la consola
 * del navegador enseña una tabla vacía, porque el listado y el borrado
 * comprueban el permiso por su cuenta y responden 403.
 */
export const AdminScreen: React.FC = () => {
  const estrecho = useMediaQuery("(max-width:900px)");

  const [esperandoSesion, setEsperandoSesion] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [problema, setProblema] = useState("");

  const [usuarios, setUsuarios] = useState<UsuarioDeAdmin[]>([]);
  const [huerfanos, setHuerfanos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [aBorrar, setABorrar] = useState<UsuarioDeAdmin | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { datos } = await llamarAdmin("usuarios");
    if (datos?.ok) {
      setUsuarios(datos.usuarios);
      setHuerfanos(datos.huerfanos ?? []);
      setProblema("");
    } else {
      setProblema(
        datos?.error === "admin-sin-configurar"
          ? "Falta la cuenta de servicio en el servidor (FIREBASE_SERVICE_ACCOUNT_B64). Sin eso no se puede listar ni borrar."
          : "No se pudo cargar la lista de usuarios."
      );
    }
    setCargando(false);
  }, []);

  /* Se espera a que Firebase restaure la sesión. En el primer render
     `currentUser` es null aunque haya sesión guardada, así que preguntar ya
     daría un 401 y la pantalla diría "no tienes acceso" a un admin con la
     sesión abierta. */
  useEffect(() => {
    const parar = FirebaseAuth.onAuthStateChanged(async (cuenta) => {
      if (!cuenta) {
        setEsAdmin(false);
        setEsperandoSesion(false);
        return;
      }
      const { datos } = await llamarAdmin("sesion");
      const ok = Boolean(datos?.ok && datos?.esAdmin);
      setEsAdmin(ok);
      setEsperandoSesion(false);
      if (ok) cargar();
    });
    return () => parar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.correo.toLowerCase().includes(q) ||
        (u.nombre ?? "").toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [usuarios, filtro]);

  if (esperandoSesion) {
    return (
      <Box sx={{ padding: 6, textAlign: "center" }}>
        <Loading />
      </Box>
    );
  }

  if (!esAdmin) {
    return (
      <Box sx={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px" }}>
        <Typography fontFamily="PT Serif" fontSize={24} sx={{ color: "#3C3C3C" }}>
          No tienes acceso a esta página
        </Typography>
        <Typography fontSize={15} sx={{ color: "#6B6B6B", marginTop: 1 }}>
          Si crees que deberías, revisa que tu cuenta esté en SUPER_ADMIN_UIDS.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1360, margin: "0 auto", padding: "24px clamp(16px, 4vw, 24px) 48px" }}>
      <Typography fontFamily="PT Serif" fontSize={26} sx={{ color: "#3C3C3C" }}>
        Administración
      </Typography>
      <Typography fontSize={14} sx={{ color: "#6B6B6B", marginTop: 0.5 }}>
        {usuarios.length} cuenta(s). Borrar es irreversible: se van los chats,
        la bóveda, el perfil y el cliente de Stripe. Los cobros ya hechos no se
        pueden borrar de Stripe.
      </Typography>

      {problema && (
        <Typography fontSize={14} sx={{ color: "var(--aviso-texto)", marginTop: 2 }}>
          {problema}
        </Typography>
      )}

      {huerfanos.length > 0 && (
        <Typography fontSize={13} sx={{ color: "var(--aviso-texto)", marginTop: 2 }}>
          Hay {huerfanos.length} documento(s) en Firestore sin cuenta de acceso
          ({huerfanos.join(", ")}). Son restos de un borrado que quedó a medias;
          hay que limpiarlos desde la consola de Firebase.
        </Typography>
      )}

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", margin: "20px 0 12px" }}>
        <TextField
          size="small"
          placeholder="Buscar por correo, nombre o uid"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          sx={{ flex: 1, maxWidth: 360 }}
        />
        <Button auto light onPress={cargar} disabled={cargando}>
          {cargando ? <Loading size="sm" /> : "Recargar"}
        </Button>
      </Box>

      {cargando && usuarios.length === 0 && <Loading />}

      {/* En pantalla estrecha, una tabla de ocho columnas obliga a hacer
          scroll horizontal para leer un correo. Se cambia por una tarjeta por
          cuenta, con lo mismo en vertical. */}
      {estrecho ? (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {visibles.map((u) => (
            <Box
              key={u.uid}
              sx={{
                border: "1px solid #E4E6EA",
                borderRadius: 1,
                padding: "12px 14px",
              }}
            >
              <Typography fontSize={15} fontWeight={600} sx={{ wordBreak: "break-all" }}>
                {u.correo || "(sin correo)"}
              </Typography>
              {u.nombre && (
                <Typography fontSize={13} sx={{ color: "#6B6B6B" }}>
                  {u.nombre}
                </Typography>
              )}
              <Box sx={{ fontSize: 13, color: "#3C3C3C", marginTop: 1 }}>
                <div>Alta: {fecha(u.creado)} · Último acceso: {fecha(u.ultimoAcceso)}</div>
                <div>
                  Plan: {u.plan || "ninguno"} · {u.chats} chat(s) ·{" "}
                  {bytes(u.bytesCifrados)}
                </div>
                <div>Entra con: {u.proveedores.join(", ") || "—"}</div>
                {!u.tieneBoveda && <div>Sin bóveda creada</div>}
              </Box>
              <Box sx={{ marginTop: 1 }}>
                {u.esAdmin ? (
                  <Typography fontSize={13} sx={{ color: "#6B6B6B" }}>
                    Administrador: no se borra desde aquí
                  </Typography>
                ) : (
                  <Button auto light color="error" size="sm" onPress={() => setABorrar(u)}>
                    Borrar
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6B6B6B" }}>
                <th style={celdaCabecera}>Correo</th>
                <th style={celdaCabecera}>Nombre</th>
                <th style={celdaCabecera}>Alta</th>
                <th style={celdaCabecera}>Último acceso</th>
                <th style={celdaCabecera}>Plan</th>
                <th style={celdaCabecera}>Chats</th>
                <th style={celdaCabecera}>Espacio</th>
                <th style={celdaCabecera}>Entra con</th>
                <th style={celdaCabecera} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.uid} style={{ borderTop: "1px solid #E4E6EA" }}>
                  <td style={celda}>
                    {u.correo || "(sin correo)"}
                    {!u.tieneBoveda && (
                      <div style={{ fontSize: 12, color: "#6B6B6B" }}>sin bóveda</div>
                    )}
                  </td>
                  <td style={celda}>{u.nombre || "—"}</td>
                  <td style={celda}>{fecha(u.creado)}</td>
                  <td style={celda}>{fecha(u.ultimoAcceso)}</td>
                  <td style={celda}>{u.plan || "—"}</td>
                  <td style={celda}>{u.chats}</td>
                  <td style={celda}>{bytes(u.bytesCifrados)}</td>
                  <td style={{ ...celda, fontSize: 12 }}>
                    {u.proveedores.join(", ") || "—"}
                  </td>
                  <td style={celda}>
                    {u.esAdmin ? (
                      <span style={{ color: "#6B6B6B", fontSize: 12 }}>admin</span>
                    ) : (
                      <Button
                        auto
                        light
                        color="error"
                        size="xs"
                        onPress={() => setABorrar(u)}
                      >
                        Borrar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      {!cargando && visibles.length === 0 && (
        <Typography fontSize={14} sx={{ color: "#6B6B6B", marginTop: 2 }}>
          Ninguna cuenta coincide.
        </Typography>
      )}

      {aBorrar && (
        <DialogoBorrado
          usuario={aBorrar}
          onCerrar={() => setABorrar(null)}
          onBorrado={() => {
            setABorrar(null);
            cargar();
          }}
        />
      )}
    </Box>
  );
};

const celdaCabecera: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const celda: React.CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
};
