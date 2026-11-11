import { FC, useContext, useEffect, useState } from "react";
import { DashboardScreen } from ".";
import { BarraBloqueada } from "../vault/BarraBloqueada";
import { yaSeOmitio } from "../vault/PantallaDesbloqueo";
import { VaultContext } from "../../context/VaultContext";

/**
 * El panel, con la barra de bóveda cerrada cuando toca (4d).
 *
 * Los pasos que ocupan la pantalla entera —desbloquear (4c) y crear la clave
 * (5a-5c)— ya no se pintan aquí sino en el Layout, a través de `PasoBoveda`.
 * El motivo está en ese componente: aquí dentro los desmontaba el spinner
 * global cada vez que algo lo encendía.
 *
 * Lo que queda es el caso de 4d: la bóveda está cerrada y el usuario ya pasó
 * del paso, así que sus chats se ven con candado y una línea le recuerda cómo
 * abrirlos. Repetirle la explicación entera ocuparía el sitio de los chats.
 */
export const DashboardMain: FC = () => {
  const { status } = useContext(VaultContext);
  const [omitido, setOmitido] = useState(true);

  /* `yaSeOmitio` lee sessionStorage, que no existe en el render de servidor. */
  useEffect(() => {
    setOmitido(yaSeOmitio());
  }, []);

  const bloqueada = status === "locked";

  return (
    <>
      {/* Las medidas son las de `br-header-inner`: 1360 de ancho, centrado, y
          el mismo padding lateral, para que empiece donde empieza el logo. */}
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          width: "100%",
          padding: "12px clamp(16px, 4vw, 24px) 0",
        }}
      >
        {bloqueada && omitido && (
          <BarraBloqueada
            onDesbloquear={() => {
              /* Volver al paso completo: lo pinta el Layout, que lee esta
                 misma marca de sessionStorage. */
              try { sessionStorage.removeItem("br:desbloqueo-omitido"); } catch {}
              setOmitido(false);
              window.dispatchEvent(new Event("br:revisar-boveda"));
            }}
          />
        )}
      </div>
      <DashboardScreen />
    </>
  );
};
