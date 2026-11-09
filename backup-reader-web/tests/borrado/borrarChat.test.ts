import { describe, it, expect, vi } from "vitest";

import {
  borrarObjetos,
  borrarChat,
  type Dependencias,
  type Pagina,
} from "../../lib/borrar-chat";

/**
 * El borrado de un chat por su dueño.
 *
 * Lo que se comprueba aquí es la contabilidad y el ORDEN, que es donde un
 * error se traduce en "el chat desapareció de la lista y sus archivos siguen
 * ocupando espacio". El cifrado y Firebase no entran: la lógica recibe sus
 * dependencias por parámetro justamente para poder probarla sin ellos.
 */

/** Un Storage de mentira: un Set de rutas que se pueden listar y borrar. */
function storageFalso(rutas: string[], opciones: { porPagina?: number } = {}) {
  const porPagina = opciones.porPagina ?? 1000;
  const existentes = new Set(rutas);
  const intentos: string[] = [];

  const deps: Dependencias = {
    listar: async (prefijo: string, pageToken?: string): Promise<Pagina> => {
      const todas = [...existentes].filter((r) => r.startsWith(prefijo)).sort();
      const desde = pageToken ? Number(pageToken) : 0;
      const trozo = todas.slice(desde, desde + porPagina);
      const fin = desde + porPagina;
      return {
        rutas: trozo,
        siguiente: fin < todas.length ? String(fin) : null,
      };
    },
    borrar: async (ruta: string) => {
      intentos.push(ruta);
      if (!existentes.has(ruta)) {
        const e: any = new Error("no existe");
        e.code = "storage/object-not-found";
        throw e;
      }
      existentes.delete(ruta);
    },
  };

  return { deps, existentes, intentos };
}

const PREFIJO = "backups/uid123/chat-abc";

function piezas(n: number): string[] {
  return [
    `${PREFIJO}/manifest`,
    ...Array.from({ length: n }, (_, i) => `${PREFIJO}/p/pieza${i}`),
  ];
}

describe("borrarObjetos", () => {
  it("borra todo lo que hay bajo el prefijo", async () => {
    const { deps, existentes } = storageFalso(piezas(5));

    const r = await borrarObjetos(PREFIJO, deps);

    expect(r.borrados).toBe(6); // manifiesto + 5 piezas
    expect(r.fallidos).toBe(0);
    expect(existentes.size).toBe(0);
  });

  it("NO toca los archivos de otro chat del mismo usuario", async () => {
    const otro = "backups/uid123/chat-xyz/p/suya";
    const { deps, existentes } = storageFalso([...piezas(2), otro]);

    await borrarObjetos(PREFIJO, deps);

    expect(existentes.has(otro)).toBe(true);
    expect(existentes.size).toBe(1);
  });

  it("SIGUE LA PAGINACION: un backup de más de una página se borra entero", async () => {
    /* `list()` de Storage devuelve como mucho 1000 entradas. Sin seguir el
       token se borraría la primera página, el recuento diría que todo fue
       bien, y el resto quedaría en el bucket para siempre. */
    const { deps, existentes } = storageFalso(piezas(250), { porPagina: 100 });

    const r = await borrarObjetos(PREFIJO, deps);

    expect(r.borrados).toBe(251);
    expect(existentes.size).toBe(0);
  });

  it("un objeto que ya no estaba cuenta como borrado, no como fallo", async () => {
    /* Es el caso de pulsar dos veces. Si contara como fallo, el segundo
       intento diría que no se pudo borrar nada y el usuario creería que su
       chat sigue ahí. */
    const { deps } = storageFalso([]);
    let listados = 0;
    const conFantasma: Dependencias = {
      ...deps,
      /* Aparece en el primer listado y ya no: es un objeto que otra pestaña
         —o un intento anterior— borró entre el listado y el borrado. */
      listar: async () => ({
        rutas: listados++ === 0 ? [`${PREFIJO}/p/fantasma`] : [],
        siguiente: null,
      }),
    };

    const r = await borrarObjetos(PREFIJO, conFantasma);

    expect(r.borrados).toBe(1);
    expect(r.fallidos).toBe(0);
  });

  it("cuenta como fallo lo que falla de verdad, y dice cuál", async () => {
    const { deps } = storageFalso(piezas(3));
    const rota = `${PREFIJO}/p/pieza1`;
    const conError: Dependencias = {
      ...deps,
      borrar: async (ruta: string) => {
        if (ruta === rota) throw new Error("permiso denegado");
        return deps.borrar(ruta);
      },
    };

    const r = await borrarObjetos(PREFIJO, conError);

    expect(r.fallidos).toBe(1);
    expect(r.rutasFallidas).toEqual([rota]);
    expect(r.borrados).toBe(3);
  });
});

describe("borrarChat: el orden", () => {
  it("borra el registro DESPUES de los archivos", async () => {
    const orden: string[] = [];
    const { deps } = storageFalso(piezas(2));

    const r = await borrarChat(PREFIJO, {
      listar: deps.listar,
      borrar: async (ruta) => {
        orden.push("archivo");
        return deps.borrar(ruta);
      },
      borrarRegistro: async () => {
        orden.push("registro");
      },
    });

    expect(r.registroBorrado).toBe(true);
    expect(r.aviso).toBeNull();
    expect(orden[orden.length - 1]).toBe("registro");
    expect(orden.filter((x) => x === "archivo").length).toBe(3);
  });

  it("CON ARCHIVOS SIN BORRAR no toca el registro, y avisa", async () => {
    /* Lo peor que puede pasar: quitar el registro dejando blobs dentro. El
       chat desaparece de la lista, sigue ocupando cuota, y ya no hay fila que
       pulsar para reintentar. */
    const { deps } = storageFalso(piezas(3));
    const borrarRegistro = vi.fn(async () => {});

    const r = await borrarChat(PREFIJO, {
      listar: deps.listar,
      borrar: async (ruta) => {
        if (ruta.endsWith("pieza2")) throw new Error("fallo de red");
        return deps.borrar(ruta);
      },
      borrarRegistro,
    });

    expect(borrarRegistro).not.toHaveBeenCalled();
    expect(r.registroBorrado).toBe(false);
    expect(r.aviso).toBe("quedaron-archivos");
    expect(r.fallidos).toBe(1);
  });

  it("si el registro falla lo dice, porque el chat queda vacío pero listado", async () => {
    const { deps } = storageFalso(piezas(2));

    const r = await borrarChat(PREFIJO, {
      ...deps,
      borrarRegistro: async () => {
        throw new Error("firestore caído");
      },
    });

    expect(r.fallidos).toBe(0);
    expect(r.registroBorrado).toBe(false);
    expect(r.aviso).toBe("registro-no-borrado");
  });

  it("sin registro que borrar (backup v1) termina limpio", async () => {
    const { deps, existentes } = storageFalso([
      "backups/uid123/whatsapp/Chat con Yuli/_chat.txt",
      "backups/uid123/whatsapp/Chat con Yuli/IMG-001.jpg",
    ]);

    const r = await borrarChat("backups/uid123/whatsapp/Chat con Yuli", deps);

    expect(r.borrados).toBe(2);
    expect(r.aviso).toBeNull();
    expect(existentes.size).toBe(0);
  });

  it("repetir el borrado de un chat ya borrado no rompe nada", async () => {
    const { deps } = storageFalso(piezas(2));

    await borrarChat(PREFIJO, { ...deps, borrarRegistro: async () => {} });
    const segunda = await borrarChat(PREFIJO, {
      ...deps,
      borrarRegistro: async () => {},
    });

    expect(segunda.fallidos).toBe(0);
    expect(segunda.aviso).toBeNull();
  });
});
