import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useVault } from "../../context/VaultContext";
import { ColumnaPasos } from "./ColumnaPasos";
import { MedidorDeClave } from "./MedidorDeClave";
import { AvisoCaja, BarraProgreso, BotonAtras, CasillaCaja, IconoPaso, Trazo } from "../ui/Paso";
import { Logo } from "../ui/BrandChrome";
import { medirFuerza, coinciden, MIN_LARGO } from "../../lib/fuerza-de-clave";

/**
 * Crear la clave de cifrado, como paso de la entrada (pantallas 5a, 5b y 5c).
 *
 * POR QUÉ DEJA DE SER UN MODAL
 * ----------------------------
 * Esto era una ventana encima del panel, con papel claro detrás y un botón
 * de "Ahora no". Tres problemas, y los tres salían de lo mismo: un modal dice
 * «esto es opcional, el sitio de verdad está detrás».
 *
 * El primero es que sin clave la aplicación no hace nada. No se puede subir
 * ni leer un chat, así que el panel de detrás era un escaparate sin puerta.
 * Quien pulsaba "Ahora no" se quedaba mirando una lista vacía con botones que
 * reabrían este mismo modal.
 *
 * El segundo es el fondo. El resto de la aplicación es papel claro; aquí se
 * escribe la clave de la que dependen todas las conversaciones, y el cambio a
 * tinta marca que se está en otro sitio. Es lo mismo que hace la pantalla de
 * desbloqueo, y por el mismo motivo.
 *
 * El tercero es el código de recuperación. Salía en OTRO modal encima de
 * este, y un modal sobre otro modal sobre el panel es donde la gente pulsa
 * fuera para quitárselo de encima. Ese código solo se enseña una vez y es lo
 * único que salva unos chats cuando se olvida la clave: aquí es el paso 3 de
 * la misma pantalla y hay que marcar que se ha guardado para seguir.
 *
 * SIN "ATRÁS", PERO CON SALIDA SI HACE FALTA
 * ------------------------------------------
 * No hay "Atrás" permanente: el diseño no lo tiene, y un botón de volver al
 * lado de "Continuar" invita a ir y venir en un trámite de tres pantallas.
 * Pero quien escribe mal la clave en el paso 1 no puede adivinarlo hasta el
 * paso 2, y sin ninguna salida se quedaría encerrado en una pantalla que
 * nunca va a aceptar lo que escribe. Por eso, SOLO después de un intento
 * fallido de confirmación, aparece "Volver a escribirla".
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/* Que la clave se acaba de crear, para que la pantalla de inicio salude (5c).
   Va en sessionStorage y no en un prop porque entre esta pantalla y la de
   inicio hay tres componentes que no tienen nada que ver con la bóveda, y
   pasarles un booleano a los tres para un saludo no compensa. Dura lo que la
   pestaña, que es lo que dura el "acabas de crearla". */
const CLAVE_RECIEN = "br:clave-recien-creada";

/* Que el paso de crear la clave está EN CURSO.
   No basta con un `useState` en quien la pinta: al crear la bóveda, el estado
   global cambia y el árbol de arriba vuelve a montar la pantalla del panel,
   lo que reinicia cualquier estado local. Con el estado local, el paso 3 —el
   código de recuperación, que solo se enseña una vez— desaparecía en el mismo
   instante en que se generaba. */
const EN_CURSO = "br:creando-clave";

export function marcarCreacionEnCurso(): void {
  try { sessionStorage.setItem(EN_CURSO, "1"); } catch { /* ver abajo */ }
}

export function terminarCreacion(): void {
  try { sessionStorage.removeItem(EN_CURSO); } catch { /* ver abajo */ }
}

/* Sin sessionStorage (ventana privada, cookies bloqueadas) esto devuelve
   false y el paso se comporta como antes: se cierra solo al crear la clave.
   Es peor, pero sigue funcionando, y la alternativa —quedarse encerrado en
   una pantalla que no se puede cerrar— es mucho peor. */
export function creacionEnCurso(): boolean {
  try { return sessionStorage.getItem(EN_CURSO) === "1"; } catch { return false; }
}

export function marcarClaveRecienCreada(): void {
  try { sessionStorage.setItem(CLAVE_RECIEN, "1"); } catch { /* sin almacenamiento, no se saluda */ }
  /* La pantalla de inicio ya está montada detrás de esta, así que leyó la
     marca cuando todavía no existía. El aviso la hace mirar otra vez. */
  try { window.dispatchEvent(new Event("br:clave-creada")); } catch { /* sin ventana, nada que avisar */ }
}

export function claveRecienCreada(): boolean {
  try { return sessionStorage.getItem(CLAVE_RECIEN) === "1"; } catch { return false; }
}

/* La paleta vive en CSS (`.br-paso` en backupreader-design.css) porque cambia
   con el ancho: tinta en móvil, papel en la columna del formulario en
   escritorio. Aquí solo se nombran las variables. */
const paleta = {
  texto: "var(--paso-texto)",
  apagado: "var(--paso-apagado)",
  tenue: "var(--paso-tenue)",
  borde: "var(--paso-borde)",
  campo: "var(--paso-campo)",
  aviso: "var(--paso-aviso)",
};

const campoBase: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 52px 0 14px",
  borderRadius: 10,
  border: `1px solid ${paleta.borde}`,
  background: paleta.campo,
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  /* El campo es blanco con texto en tinta también sobre fondo de tinta (5a). */
  color: "var(--ink-900)",
};

const etiquetaBase: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--paso-tenue)",
  marginBottom: 8,
};

const botonPrincipal = (activo: boolean): React.CSSProperties => ({
  marginTop: 22,
  width: "100%",
  minHeight: 52,
  borderRadius: 10,
  border: "none",
  cursor: activo ? "pointer" : "default",
  opacity: activo ? 1 : 0.5,
  background: "var(--paso-accion)",
  color: "var(--paso-accion-texto)",
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  fontWeight: 600,
});

export const PantallaCrearClave: FC<{ onListo?: () => void }> = ({ onListo }) => {
  const { t } = useTranslation();
  const { registerVault } = useVault();

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [verla, setVerla] = useState(false);
  const [entiendo, setEntiendo] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  /* Solo tras fallar la confirmación se ofrece volver. Ver la nota de arriba. */
  const [falloAlConfirmar, setFalloAlConfirmar] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoRef.current?.focus();
  }, [paso]);

  const fuerza = medirFuerza(clave);
  const igualan = coinciden(clave, repetida);

  const continuar = () => {
    if (!fuerza.valida) {
      setAviso(enTexto(t("La clave debe tener al menos {{n}} caracteres.", { n: MIN_LARGO })));
      return;
    }
    setAviso("");
    setPaso(2);
  };

  const crear = async () => {
    if (!igualan) {
      setAviso(enTexto(t("Las dos contraseñas no coinciden.")));
      setFalloAlConfirmar(true);
      return;
    }
    if (!entiendo) {
      setAviso(enTexto(t("Marca la casilla para continuar.")));
      return;
    }
    setAviso("");
    setOcupado(true);
    const generado = await registerVault(clave);
    setOcupado(false);
    if (!generado) {
      setAviso(enTexto(t("No se pudo crear la protección. Inténtalo de nuevo.")));
      return;
    }
    setCodigo(generado);
    setPaso(3);
  };

  const ojo = (
    <button
      type="button"
      aria-label={enTexto(t(verla ? "Ocultar contraseña" : "Ver contraseña"))}
      onClick={() => setVerla((v) => !v)}
      style={{
        position: "absolute",
        right: 4,
        top: 4,
        width: 44,
        height: 44,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        /* El campo es blanco en los dos tamaños: el ojo va en pizarra. */
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
  );

  /* Los pasos del alta son TRES y el plan es el primero (6a: «Paso 1 de 3»).
     Crear la clave es el 2 y confirmarla el 3, como en 5a/5b y en la columna
     de 7d/7e. El código de recuperación va después, fuera de la cuenta. */
  const pasoGlobal = paso + 1;
  const nombreFuerza: Record<string, string> = {
    excelente: enTexto(t("excelente")),
    buena: enTexto(t("buena")),
    simple: enTexto(t("débil")),
    corta: enTexto(t("débil")),
  };
  /* La columna de 7d/7e: lo hecho dice QUÉ se hizo (el plan, la clave con su
     fuerza), no solo que el paso está tachado. */
  const pasos: Array<{ titulo: string; pie: string; hecho: boolean; activo: boolean }> = [
    { titulo: enTexto(t("Plan Personal")), pie: enTexto(t("$2.99/mes · recibo enviado")), hecho: true, activo: false },
    paso >= 2
      ? { titulo: enTexto(t("Clave creada")), pie: enTexto(t("Fuerza: {{fuerza}}", { fuerza: nombreFuerza[fuerza.nivel] })), hecho: true, activo: false }
      : { titulo: enTexto(t("Crea tu clave de cifrado")), pie: enTexto(t("Solo tú la conoces.")), hecho: false, activo: true },
    { titulo: enTexto(t("Confírmala")), pie: enTexto(t("Para asegurarnos de que la recuerdas.")), hecho: paso >= 3, activo: paso === 2 },
  ];
  const columna =
    paso === 1
      ? { encabezado: t("Plan activo"), titulo: t("Ahora, tu clave.") }
      : paso === 2
      ? { encabezado: t("Último paso"), titulo: t("Una vez más.") }
      : { encabezado: t("Clave creada"), titulo: t("Guarda tu código.") };

  const etiquetaCampo: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: 600,
    color: paleta.texto,
    marginBottom: 6,
  };

  return (
    <div className="br-paso">
      {/* En escritorio, la tinta se queda en esta columna y el formulario va
          sobre papel (7d). En móvil el CSS la esconde y la pantalla entera es
          de tinta (5a). */}
      <ColumnaPasos encabezado={enTexto(columna.encabezado)} titulo={enTexto(columna.titulo)}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {pasos.map((p, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "14px 0",
                borderTop: "1px solid var(--border-on-ink)",
                borderBottom: i === pasos.length - 1 ? "1px solid var(--border-on-ink)" : undefined,
                opacity: p.activo || p.hecho ? 1 : 0.6,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  background: p.activo ? "var(--brass-400)" : p.hecho ? "var(--ink-700)" : "transparent",
                  border: p.activo || p.hecho ? "none" : "1px solid var(--border-on-ink)",
                  color: p.activo ? "var(--ink-950)" : "var(--paper-50)",
                }}
              >
                {p.hecho ? "✓" : `0${i + 1}`}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--paper-50)" }}>
                  {p.titulo}
                </span>
                <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--ink-100)" }}>{p.pie}</span>
              </span>
            </li>
          ))}
        </ol>
      </ColumnaPasos>

      <div className="br-paso-main">
        {/* Cabecera de móvil: logo y «Paso x de 3» (5a), o la flecha de atrás
            en la confirmación (5b), con la barra de progreso debajo. */}
        <div className="br-paso-solo-movil" style={{ margin: "-24px -20px 0" }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid var(--border-on-ink)" }}>
            {paso === 2 ? (
              <BotonAtras
                oscuro
                etiqueta={enTexto(t("Volver a escribirla"))}
                onClick={() => {
                  setPaso(1);
                  setRepetida("");
                  setAviso("");
                  setFalloAlConfirmar(false);
                }}
              />
            ) : (
              <Logo oscuro compact />
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-100)" }}>
              {paso === 3 ? enTexto(t("Clave guardada")) : enTexto(t("Paso {{n}} de 3", { n: pasoGlobal }))}
            </span>
          </div>
          <BarraProgreso continua oscuro hechos={Math.min(pasoGlobal, 3)} />
        </div>

        <div className="br-paso-cuerpo">
          {paso === 1 && (
            <>
              <div className="br-paso-solo-movil"><IconoPaso tipo="llave" tono="sobreTinta" /></div>
              <div className="br-paso-solo-escritorio"><IconoPaso tipo="llave" tono="tinta" tam={48} /></div>
            </>
          )}

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500, lineHeight: 1.15, color: paleta.texto, margin: paso === 1 ? "24px 0 10px" : "0 0 10px" }}>
            {paso === 1
              ? t("Crea tu clave de cifrado")
              : paso === 2
              ? t("Escríbela otra vez")
              : t("Guarda tu código de recuperación")}
          </h1>

          {paso === 1 && (
            <>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: paleta.apagado, margin: "0 0 24px" }}>
                {/* «Teléfono» en móvil (5a), «dispositivo» en escritorio (7d). */}
                <span className="br-solo-movil-inline">
                  {t("Con ella ciframos tus chats en tu teléfono antes de guardarlos. Nosotros no la conocemos.")}
                </span>
                <span className="br-solo-escritorio-inline">
                  {t("Con ella ciframos tus chats en tu dispositivo antes de guardarlos. Nosotros no la conocemos.")}
                </span>
              </p>
              <label style={etiquetaCampo}>{t("Clave de cifrado")}</label>
              <div style={{ position: "relative" }}>
                <input
                  ref={campoRef}
                  type={verla ? "text" : "password"}
                  value={clave}
                  autoComplete="new-password"
                  onChange={(e) => { setClave(e.target.value); setAviso(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") continuar(); }}
                  style={{ ...campoBase, borderColor: aviso ? paleta.aviso : paleta.borde }}
                />
                {ojo}
              </div>
              <MedidorDeClave clave={clave} />
              {aviso && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: paleta.aviso, margin: "8px 0 0" }}>{aviso}</p>
              )}
              {/* Aviso en caja (5a sobre tinta, 7d en ocre sobre papel). */}
              <div style={{ marginTop: 22 }}>
                <div className="br-paso-solo-movil">
                  <AvisoCaja tono="sobreTinta">{t("Si la olvidas, no podremos abrir tus chats. Guárdala en un lugar seguro.")}</AvisoCaja>
                </div>
                <div className="br-paso-solo-escritorio">
                  <AvisoCaja tono="ocre">{t("Si la olvidas, no podremos abrir tus chats. Guárdala en un lugar seguro.")}</AvisoCaja>
                </div>
              </div>
              <div className="br-paso-acciones">
                <button type="button" onClick={continuar} disabled={!clave} style={{ ...botonPrincipal(!!clave), marginTop: 0 }}>
                  {t("Continuar")}
                </button>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: paleta.apagado, margin: "0 0 24px" }}>
                {t("Así confirmamos que la recuerdas bien.")}
              </p>
              <label style={etiquetaCampo}>{t("Confirma tu clave")}</label>
              <div style={{ position: "relative" }}>
                <input
                  ref={campoRef}
                  type={verla ? "text" : "password"}
                  value={repetida}
                  autoComplete="new-password"
                  onChange={(e) => { setRepetida(e.target.value); setAviso(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
                  style={{
                    ...campoBase,
                    borderColor: aviso ? paleta.aviso : repetida && igualan ? "var(--pine-600)" : paleta.borde,
                  }}
                />
                {/* Con las dos iguales, la marca de verificación ocupa el sitio
                    del ojo (5b): ya no hace falta ver la clave. */}
                {repetida && igualan ? (
                  <span style={{ position: "absolute", right: 14, top: 15, color: "var(--pine-600)" }}>
                    <Trazo tipo="check" tam={20} />
                  </span>
                ) : (
                  ojo
                )}
              </div>

              {/* En vivo: esperar al botón para decir que no coinciden obliga a
                  reescribir las dos. */}
              {repetida.length > 0 && (
                <span
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: igualan ? "var(--paso-ok)" : paleta.aviso,
                  }}
                >
                  {igualan ? t("Las claves coinciden") : t("Las claves no coinciden")}
                </span>
              )}

              <div style={{ marginTop: 20 }}>
                <CasillaCaja marcada={entiendo} onCambio={setEntiendo} oscuro>
                  {t("Entiendo que, si pierdo esta clave, mis chats no se pueden recuperar.")}
                </CasillaCaja>
              </div>

              {aviso && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: paleta.aviso, margin: "10px 0 0" }}>{aviso}</p>
              )}

              <div className="br-paso-acciones">
                <button
                  type="button"
                  onClick={crear}
                  disabled={ocupado || !igualan || !entiendo}
                  style={{ ...botonPrincipal(!ocupado && igualan && entiendo), marginTop: 0 }}
                >
                  {ocupado ? (
                    t("Guardando…")
                  ) : (
                    <>
                      <span className="br-paso-solo-movil-inline">{t("Guardar clave")}</span>
                      <span className="br-paso-solo-escritorio-inline">{t("Guardar clave y empezar")}</span>
                    </>
                  )}
                </button>

                {falloAlConfirmar && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaso(1);
                      setRepetida("");
                      setAviso("");
                      setFalloAlConfirmar(false);
                    }}
                    style={{
                      minHeight: 44,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: 14.5,
                      color: paleta.apagado,
                      textDecoration: "underline",
                    }}
                  >
                    {t("Volver a escribirla")}
                  </button>
                )}
              </div>
            </>
          )}

          {paso === 3 && codigo && (
            <>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: paleta.apagado, margin: "0 0 20px" }}>
                {t("Es lo único que abre tus chats si olvidas la clave. Solo se enseña ahora.")}
              </p>

              <div
                style={{
                  padding: "18px 16px",
                  borderRadius: 10,
                  border: `1px solid ${paleta.borde}`,
                  background: "var(--paso-codigo)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 17,
                  letterSpacing: "0.16em",
                  wordBreak: "break-all",
                  color: paleta.texto,
                  textAlign: "center",
                }}
              >
                {codigo}
              </div>

              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(codigo); }}
                style={{
                  marginTop: 12,
                  minHeight: 44,
                  width: "100%",
                  borderRadius: 10,
                  border: `1px solid ${paleta.borde}`,
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  color: paleta.texto,
                }}
              >
                {t("Copiar código")}
              </button>

              <div style={{ marginTop: 20 }}>
                <CasillaCaja marcada={guardado} onCambio={setGuardado} oscuro>
                  {t("Lo he guardado en un lugar seguro.")}
                </CasillaCaja>
              </div>

              <div className="br-paso-acciones">
                <button
                  type="button"
                  onClick={() => { marcarClaveRecienCreada(); terminarCreacion(); onListo?.(); }}
                  disabled={!guardado}
                  style={{ ...botonPrincipal(guardado), marginTop: 0 }}
                >
                  {t("Entrar a mis chats")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PantallaCrearClave;
