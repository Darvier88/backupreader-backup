export interface FileList {
  name: string;
  fullPath: string;
  /**
   * De qué plataforma salió este chat, para agruparlos en la barra lateral.
   *
   * No cuesta nada traerlo: en los cifrados ya se descifra el manifiesto para
   * leer el nombre, y ahí está; en los de texto plano lo dice la carpeta.
   *
   * Puede faltar en una entrada bloqueada: con la bóveda cerrada no se puede
   * abrir el manifiesto, así que de esos chats no se sabe ni el nombre ni de
   * dónde vienen. Esos van aparte, sin grupo.
   */
  origen?: "whatsapp" | "instagram" | "other";
  /**
   * `true` cuando el backup existe pero la boveda esta bloqueada, asi que su
   * nombre todavia no se puede leer. La barra lateral lo pinta con candado en
   * vez de esconderlo: esconderlo haria creer que no hay chats.
   */
  bloqueado?: boolean;
  /**
   * `true` si el backup está cifrado (v2); `false` si sigue en texto plano (v1).
   *
   * La barra lateral lo usa para marcar los que faltan por cifrar y ofrecer el
   * botón de migración. Cuando no quede ningún v1, este campo y todo lo que
   * cuelga de él se pueden quitar.
   */
  cifrado: boolean;
  /**
   * Cuándo se guardó el backup, en epoch ms, para «Guardado hoy» en Recientes
   * (8b). Sale del documento de Firestore, que ya lleva esa fecha para la
   * cuota, así que no hay que pedir nada nuevo ni contarle nada al servidor.
   *
   * Los backups v1, en texto plano, no lo traen: allí la lista enseña
   * «Guardado» a secas, que es lo que ponía antes para todos.
   */
  creadoEn?: number;
}

export interface FileDetail {
  url: string;
  name: string;
}

export type Chat = string[];
