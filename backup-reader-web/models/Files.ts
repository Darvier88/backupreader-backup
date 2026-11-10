export interface FileList {
  name: string;
  fullPath: string;
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
}

export interface FileDetail {
  url: string;
  name: string;
}

export type Chat = string[];
