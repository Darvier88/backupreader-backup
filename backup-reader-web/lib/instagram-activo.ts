/**
 * Si la lectura de respaldos de Instagram está encendida.
 *
 * Apagada si falta la variable, como el análisis: así el código puede entrar
 * en producción antes de que la función esté lista para enseñarse, y se
 * enciende cuando toque sin otro despliegue.
 *
 * Con esto apagado, un zip de Instagram se sube entero y se comporta como
 * antes; no se pregunta por conversaciones ni se enseña nada nuevo.
 */
export const INSTAGRAM_ACTIVO = process.env.NEXT_PUBLIC_INSTAGRAM_ENABLED === "1";
