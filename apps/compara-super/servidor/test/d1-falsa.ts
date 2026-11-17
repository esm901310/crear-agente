/**
 * D1 de mentira para pruebas: misma interfaz básica (prepare/bind/first/all/run/batch)
 * sobre SQLite en memoria de Node (node:sqlite), con las migraciones reales aplicadas.
 * Solo para pruebas; no se usa en el servidor.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const cargar = (m: string): Promise<any> => import(/* @vite-ignore */ m);

export async function crearD1(): Promise<D1Database> {
  const { DatabaseSync } = await cargar('node:sqlite');
  const { readFileSync } = await cargar('node:fs');
  const db = new DatabaseSync(':memory:');
  const { readdirSync } = await cargar('node:fs');
  const carpeta = new URL('../migrations/', (import.meta as unknown as { url: string }).url);
  // Todas las migraciones, en orden (0001_..., 0002_..., ...), como hace wrangler.
  for (const archivo of (readdirSync(carpeta) as string[]).filter((a) => a.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(archivo, carpeta), 'utf8'));
  }

  const limpio = (fila: any) => (fila ? { ...fila } : null);
  class Sentencia {
    constructor(
      private sql: string,
      private params: unknown[] = [],
    ) {}
    bind(...params: unknown[]) {
      return new Sentencia(this.sql, params);
    }
    async first<T>(): Promise<T | null> {
      return limpio(db.prepare(this.sql).get(...this.params)) as T | null;
    }
    todasSync<T>() {
      return { results: db.prepare(this.sql).all(...this.params).map(limpio) as T[], success: true, meta: {} };
    }
    async all<T>() {
      return this.todasSync<T>();
    }
    async run() {
      const info = db.prepare(this.sql).run(...this.params);
      return { results: [], success: true, meta: { changes: Number(info.changes) } };
    }
  }
  const d1 = {
    prepare: (sql: string) => new Sentencia(sql),
    // Síncrono entre BEGIN y COMMIT para que dos lotes en paralelo no se mezclen.
    async batch(sentencias: Sentencia[]) {
      db.exec('BEGIN');
      try {
        const salida = [];
        for (const s of sentencias) salida.push(s.todasSync());
        db.exec('COMMIT');
        return salida;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return d1 as unknown as D1Database;
}
