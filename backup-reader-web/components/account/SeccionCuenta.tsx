import { FC, ReactNode } from "react";

/** Una sección de Mi cuenta (12d/12e): etiqueta en mono y el contenido debajo,
 *  separada de la siguiente por una línea. */
export const SeccionCuenta: FC<{ etiqueta: ReactNode; children: ReactNode }> = ({ etiqueta, children }) => (
  <section className="br-cuenta-seccion">
    <div className="br-cuenta-etiqueta">{etiqueta}</div>
    {children}
  </section>
);
