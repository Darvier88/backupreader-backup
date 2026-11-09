import { describe, it, expect, vi } from "vitest";

import {
  borrarFirestore,
  borrarStorage,
  TOPE_ARCHIVOS,
} from "../../lib/admin-borrado";

/**
 * La contabilidad del borrado.
 *
 * El endpoint decide si borra la cuenta de Auth mirando `quedan`. Así que lo
 * que de verdad protege los datos no es que el borrado funcione, sino que
 * `quedan` NO salga en cero cuando todavía hay algo:
 *
 *  - Si quedan archivos por tope, la cuenta no se borra y se puede repetir.
 *  - Si un archivo falló, tampoco: si contara como terminado, se borraría la
 *    cuenta y el bucket se quedaría con datos cifrados de alguien que ya no
 *    existe y que nadie volvería a mirar, porque ya no sale en ninguna lista.
 *
 * También se comprueba el orden en Firestore: la subcolección antes que el
 * padre. Borrar el padre primero no da error —Firestore lo permite— y deja
 * los metadatos de los chats vivos bajo un documento que ya no existe, que
 * siguen apareciendo en `collectionGroup("backups")`.
 *
 * Se usan dobles del bucket y de Firestore: lo que se prueba es esta lógica,
 * no el SDK de Google. Que los objetos se vayan de verdad del bucket se
 * comprueba con los emuladores, fuera de aquí.
 */

/* ------------------------------------------------------------------ *
 *  Doble de bucket
 * ------------------------------------------------------------------ */

function bucketFalso(rutas: string[], queFallan: string[] = []) {
  const borrados: string[] = [];
  const bucket = {
    pedidos: [] as string[],
    async getFiles({ prefix }: { prefix: string }) {
      bucket.pedidos.push(prefix);
      const archivos = rutas
        .filter((r) => r.startsWith(prefix))
        .map((r) => ({
          name: r,
          async delete() {
            if (queFallan.includes(r)) throw new Error(`403 en ${r}`);
            borrados.push(r);
          },
        }));
      return [archivos] as [typeof archivos];
    },
  };
  return { bucket, borrados };
}

const piezas = (uid: string, n: number) => [
  `backups/${uid}/b1/manifest`,
  ...Array.from({ length: n }, (_, i) => `backups/${uid}/b1/p/${i}`),
];

describe("borrar Storage", () => {
  it("borra todo lo del usuario y no deja nada pendiente", async () => {
    const rutas = piezas("uid-ana", 30);
    const { bucket, borrados } = bucketFalso(rutas);

    const paso = await borrarStorage("uid-ana", bucket);

    expect(paso.borrados).toBe(rutas.length);
    expect(paso.fallidos).toBe(0);
    expect(paso.quedan).toBe(0);
    expect(borrados.sort()).toEqual(rutas.sort());
  });

  it("no toca los archivos de otro usuario", async () => {
    const mios = piezas("uid-ana", 5);
    const ajenos = piezas("uid-beto", 5);
    const { bucket, borrados } = bucketFalso([...mios, ...ajenos]);

    await borrarStorage("uid-ana", bucket);

    expect(bucket.pedidos).toEqual(["backups/uid-ana/"]);
    expect(borrados.some((r) => r.includes("uid-beto"))).toBe(false);
    expect(borrados.length).toBe(mios.length);
  });

  it("con más archivos que el tope, reporta el resto como pendiente", async () => {
    const rutas = piezas("uid-ana", TOPE_ARCHIVOS + 120);
    const { bucket } = bucketFalso(rutas);

    const paso = await borrarStorage("uid-ana", bucket);

    expect(paso.borrados).toBe(TOPE_ARCHIVOS);
    expect(paso.quedan).toBe(rutas.length - TOPE_ARCHIVOS);
    /* Mientras quede algo, el endpoint no borra la cuenta. */
    expect(paso.quedan).toBeGreaterThan(0);
  });

  it("un archivo que falla cuenta como pendiente, no solo como fallido", async () => {
    const rutas = piezas("uid-ana", 20);
    const terco = rutas[7];
    const { bucket, borrados } = bucketFalso(rutas, [terco]);

    const paso = await borrarStorage("uid-ana", bucket);

    expect(paso.fallidos).toBe(1);
    expect(paso.borrados).toBe(rutas.length - 1);
    /* Lo que impide que el endpoint borre la cuenta dejando basura dentro. */
    expect(paso.quedan).toBe(1);
    expect(borrados).not.toContain(terco);
  });

  it("un fallo no interrumpe el borrado de los demás", async () => {
    const rutas = piezas("uid-ana", 40);
    /* Varios fallos repartidos, incluido uno en el primer lote. */
    const malos = [rutas[0], rutas[13], rutas[39]];
    const { bucket, borrados } = bucketFalso(rutas, malos);

    const paso = await borrarStorage("uid-ana", bucket);

    expect(paso.fallidos).toBe(3);
    expect(paso.borrados).toBe(rutas.length - 3);
    for (const m of malos) expect(borrados).not.toContain(m);
  });

  it("un usuario sin nada en Storage no es un error", async () => {
    const { bucket } = bucketFalso([]);
    const paso = await borrarStorage("uid-vacio", bucket);
    expect(paso).toEqual({ borrados: 0, fallidos: 0, quedan: 0 });
  });
});

/* ------------------------------------------------------------------ *
 *  Doble de Firestore
 * ------------------------------------------------------------------ */

function dbFalsa(backups: string[]) {
  const orden: string[] = [];
  const borrados: string[] = [];

  const refDe = (ruta: string) => ({ ruta });

  const db: any = {
    collection(nombre: string) {
      return {
        doc(id: string) {
          return {
            collection(sub: string) {
              return {
                async get() {
                  orden.push(`get:${nombre}/${id}/${sub}`);
                  return {
                    docs: backups.map((b) => ({
                      ref: refDe(`${nombre}/${id}/${sub}/${b}`),
                    })),
                  };
                },
              };
            },
            async delete() {
              orden.push(`delete:${nombre}/${id}`);
              borrados.push(`${nombre}/${id}`);
            },
          };
        },
      };
    },
    batch() {
      const pendientes: any[] = [];
      return {
        delete(ref: any) {
          pendientes.push(ref);
        },
        async commit() {
          orden.push(`commit:${pendientes.length}`);
          for (const r of pendientes) borrados.push(r.ruta);
        },
      };
    },
  };

  return { db, orden, borrados };
}

describe("borrar Firestore", () => {
  it("borra los metadatos de los chats ANTES que la bóveda", async () => {
    const { db, orden } = dbFalsa(["c1", "c2", "c3"]);

    await borrarFirestore("uid-ana", db);

    const commit = orden.findIndex((o) => o.startsWith("commit:"));
    const boveda = orden.indexOf("delete:vaults/uid-ana");

    expect(commit).toBeGreaterThanOrEqual(0);
    expect(boveda).toBeGreaterThanOrEqual(0);
    /* Al revés, los metadatos quedarían vivos bajo un padre inexistente. */
    expect(commit).toBeLessThan(boveda);
  });

  it("borra la bóveda, el estado y el perfil", async () => {
    const { db, borrados } = dbFalsa([]);

    const paso = await borrarFirestore("uid-ana", db);

    expect(paso).toEqual({ backups: 0, boveda: true, estado: true, perfil: true });
    expect(borrados).toEqual([
      "vaults/uid-ana",
      "userStatus/uid-ana",
      "users/uid-ana",
    ]);
  });

  it("cuenta bien los chats y los borra en lotes bajo el límite de Firestore", async () => {
    /* 900 documentos: más de un lote, y ninguno puede pasar de 500
       escrituras o Firestore rechaza el commit entero. */
    const muchos = Array.from({ length: 900 }, (_, i) => `c${i}`);
    const { db, orden } = dbFalsa(muchos);

    const paso = await borrarFirestore("uid-ana", db);

    expect(paso.backups).toBe(900);

    const tamanos = orden
      .filter((o) => o.startsWith("commit:"))
      .map((o) => Number(o.split(":")[1]));
    expect(tamanos.reduce((a, b) => a + b, 0)).toBe(900);
    for (const t of tamanos) expect(t).toBeLessThanOrEqual(500);
  });

  it("un usuario sin chats tampoco falla", async () => {
    const { db, orden } = dbFalsa([]);
    await borrarFirestore("uid-vacio", db);
    /* Sin documentos no hay commit que hacer. */
    expect(orden.filter((o) => o.startsWith("commit:"))).toEqual([]);
  });
});
