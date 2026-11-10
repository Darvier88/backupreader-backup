import { FC, useContext, useEffect, useState } from "react";
import { DashboardScreen } from ".";
import { VaultBanner } from "../vault";
import { PantallaDesbloqueo, yaSeOmitio } from "../vault/PantallaDesbloqueo";
import { BarraBloqueada } from "../vault/BarraBloqueada";
import { VaultContext } from "../../context/VaultContext";

/**
 * El panel, con el estado de la bóveda delante cuando toca (4c y 4d).
 *
 * Tres situaciones, y cada una pide algo distinto:
 *
 *  - Bóveda abierta: no hay nada que decir, se ve el panel y ya.
 *  - Bloqueada y recién entrado: el desbloqueo ocupa la pantalla (4c). Es lo
 *    único que hay que hacer para que la aplicación sirva de algo, así que
 *    compartir sitio con el panel solo conseguía que se ignorara.
 *  - Bloqueada y ya omitido: una línea con el botón (4d). Quien omitió ya leyó
 *    la explicación hace un momento; repetírsela entera ocupa el sitio de sus
 *    chats.
 *
 * La bóveda sin crear sigue con el aviso de siempre: ahí no hay contraseña que
 * pedir todavía, el paso es otro (crearla), y eso es la ronda 5.
 */
export const DashboardMain: FC = () => {
  const { status } = useContext(VaultContext);

  /* Arranca en true para no enseñar el paso durante el parpadeo inicial, en el
     que `status` todavía es "checking" y aún no se sabe si hace falta. */
  const [omitido, setOmitido] = useState(true);

  /* `yaSeOmitio` lee sessionStorage, que no existe durante el renderizado del
     servidor. Se consulta ya montado, que además es cuando el estado de la
     bóveda es de fiar. */
  useEffect(() => {
    setOmitido(yaSeOmitio());
  }, []);

  const bloqueada = status === "locked";
  const mostrarPaso = bloqueada && !omitido;

  if (mostrarPaso) {
    return <PantallaDesbloqueo onOmitir={() => setOmitido(true)} />;
  }

  return (
    <>
      {/* Las medidas son las de `br-header-inner`: 1360 de ancho, centrado, y
          el mismo padding lateral, para que empiece donde empieza el logo.

          Ojo a una inconsistencia que ya existía y que esto NO arregla: el
          `Grid.Container` de DashboardScreen va con `gap={0}`, que en NextUI
          se traduce en padding 0, así que el panel de chats empieza entre 16 y
          24 px más a la izquierda que el logo. */}
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          width: "100%",
          padding: "12px clamp(16px, 4vw, 24px) 0",
        }}
      >
        {bloqueada ? (
          <BarraBloqueada onDesbloquear={() => setOmitido(false)} />
        ) : (
          /* Bóveda sin crear: el aviso de siempre, que lleva a crearla. */
          <VaultBanner />
        )}
      </div>
      <DashboardScreen />
    </>
  );
};
