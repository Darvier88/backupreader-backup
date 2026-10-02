export interface FileList {
  name: string;
  fullPath: string;
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
