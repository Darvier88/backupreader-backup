/**
 * «2,0 MB», «850 KB», «1,2 GB» para enseñar cuánto ocupan los chats.
 *
 * Base 1000 (como el móvil y el Mac al enseñar el tamaño de un archivo), no
 * 1024: así «mis chats pesan 2 megas» coincide con lo que la persona vio en
 * su teléfono al exportar.
 */
export function tamanoLegible(bytes: number, idioma = "es"): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let valor = n;
  let i = 0;
  while (valor >= 1000 && i < unidades.length - 1) {
    valor /= 1000;
    i++;
  }
  /* Un decimal a partir de MB («2,4 MB»); en B y KB los decimales no dicen
     nada útil. */
  const decimales = i >= 2 && valor < 100 ? 1 : 0;
  const numero = new Intl.NumberFormat(idioma.startsWith("en") ? "en" : "es", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
  return `${numero} ${unidades[i]}`;
}
