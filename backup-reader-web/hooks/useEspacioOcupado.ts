import { useContext, useEffect, useState } from "react";

import { FirestoreContext } from "../context";
import { StorageContext } from "../context/StorageContext";
import { listarBackups } from "../config/backupRepo";

/**
 * Cuánto ocupan los chats del usuario, en bytes, y cuántos son.
 *
 * Sale de `cipherBytes` en `vaults/{uid}/backups/*`: es lo que de verdad hay
 * guardado en Storage (las piezas cifradas), y es la misma cifra que se usa
 * para las cuotas del plan. No hace falta descifrar nada para sumarlo.
 *
 * Se vuelve a pedir cuando cambia la lista de chats, para que subir o borrar
 * uno se note sin recargar la página.
 *
 * Los chats antiguos en texto plano (v1) no tienen ese documento y no cuentan
 * aquí; se migran solos a cifrados al abrir la bóveda y entonces sí cuentan.
 *
 * `null` mientras carga o si no se pudo leer: quien lo pinta no enseña nada
 * antes que enseñar un «0 B» que no es verdad.
 */
export function useEspacioOcupado(): { bytes: number; chats: number } | null {
  const { user } = useContext(FirestoreContext);
  const { fileList } = useContext(StorageContext);
  const [espacio, setEspacio] = useState<{ bytes: number; chats: number } | null>(null);

  const uid = user?.uid;
  const cuantos = fileList?.length ?? 0;

  useEffect(() => {
    if (!uid) {
      setEspacio(null);
      return;
    }
    let vigente = true;
    listarBackups(uid)
      .then((docs) => {
        if (!vigente) return;
        const bytes = docs.reduce((a, d) => a + (Number(d.cipherBytes) || 0), 0);
        setEspacio({ bytes, chats: docs.length });
      })
      .catch((error) => {
        console.warn("No se pudo calcular el espacio ocupado:", error);
        if (vigente) setEspacio(null);
      });
    return () => {
      vigente = false;
    };
  }, [uid, cuantos]);

  return espacio;
}
