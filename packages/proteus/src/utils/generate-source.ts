export type GenerateSourceCache = "redis" | "memory";

export type GenerateSourceOptions = {
  /** Proteus driver name. */
  driver: string;
  /**
   * Import path for the project logger. When provided, emits
   * `import { logger } from "<loggerImport>"` and wires `logger` into
   * ProteusSource options. When omitted, the generated file carries a
   * TODO placeholder so a user can bring their own logger.
   */
  loggerImport?: string | null;
  /**
   * Import path for a typed config module (e.g. `../../pylon/config.js`).
   * When provided, the generated source reads connection strings from
   * `config.<driver>Url` / `config.sqlitePath` instead of hard-coding
   * localhost defaults. Redis cache adapters likewise read
   * `config.redisUrl`.
   */
  configImport?: string | null;
  /**
   * Import path for an amphora instance (e.g. `../../pylon/amphora.js`).
   * When provided, emits `import { amphora } from "<amphoraImport>"` and
   * wires `amphora` into ProteusSource options so that `@Encrypted`
   * fields on registered entities encrypt/decrypt transparently.
   */
  amphoraImport?: string | null;
  /**
   * Attach a query-cache adapter. Only meaningful for DB drivers
   * (postgres/mysql/mongo); ignored for redis/sqlite/memory primaries.
   */
  cache?: GenerateSourceCache | null;
  /**
   * keyPrefix passed to RedisCacheAdapter. Ignored when `cache !== "redis"`.
   * Defaults to `"<driver>:cache:"` so parallel DB sources don't collide.
   */
  cacheKeyPrefix?: string;
};

const SQL_DRIVERS = ["postgres", "mysql", "sqlite"];
const DB_DRIVERS = ["postgres", "mysql", "mongo"];

const urlField = (driver: string, configImport: string | null | undefined): string => {
  if (!configImport) return "";

  switch (driver) {
    case "postgres":
      return `  url: config.postgres.url,`;
    case "mysql":
      return `  url: config.mysql.url,`;
    case "mongo":
      return `  url: config.mongo.url,`;
    case "redis":
      return `  url: config.redis.url,`;
    case "sqlite":
      return `  filename: config.sqlite.path,`;
    default:
      return "";
  }
};

const hardcodedConnection = (driver: string): Array<string> => {
  switch (driver) {
    case "postgres":
      return [`  host: "localhost",`, `  port: 5432,`, `  database: "app",`];
    case "mysql":
      return [`  host: "localhost",`, `  port: 3306,`, `  database: "app",`];
    case "sqlite":
      return [`  filename: "./data/app.db",`];
    case "redis":
      return [`  host: "localhost",`, `  port: 6379,`];
    case "mongo":
      return [`  host: "localhost",`, `  port: 27017,`, `  database: "app",`];
    default:
      return [];
  }
};

const cacheImport = (cache: GenerateSourceCache | null | undefined): string | null => {
  switch (cache) {
    case "redis":
      return "RedisCacheAdapter";
    case "memory":
      return "MemoryCacheAdapter";
    default:
      return null;
  }
};

const cacheBlock = (
  driver: string,
  cache: GenerateSourceCache | null | undefined,
  configImport: string | null | undefined,
  keyPrefix: string,
): Array<string> => {
  if (!cache || !DB_DRIVERS.includes(driver)) return [];

  if (cache === "memory") {
    return [
      `  cache: {`,
      `    adapter: new MemoryCacheAdapter(),`,
      `    ttl: "1m",`,
      `  },`,
    ];
  }

  const adapterOptions = configImport
    ? `{ url: config.redis.url, keyPrefix: "${keyPrefix}" }`
    : `{ host: "localhost", port: 6379, keyPrefix: "${keyPrefix}" }`;

  return [
    `  cache: {`,
    `    adapter: new RedisCacheAdapter(${adapterOptions}),`,
    `    ttl: "1m",`,
    `  },`,
  ];
};

export const generateSource = (options: GenerateSourceOptions): string => {
  const { driver, loggerImport, configImport, amphoraImport, cache, cacheKeyPrefix } =
    options;
  const isSql = SQL_DRIVERS.includes(driver);
  const effectiveCache = cache && DB_DRIVERS.includes(driver) ? cache : null;
  const adapterName = cacheImport(effectiveCache);
  const keyPrefix = cacheKeyPrefix ?? `${driver}:cache:`;

  const lines: Array<string> = [];

  if (loggerImport) {
    lines.push(`import { logger } from "${loggerImport}";`);
  }

  if (amphoraImport) {
    lines.push(`import { amphora } from "${amphoraImport}";`);
  }

  if (configImport) {
    lines.push(`import { config } from "${configImport}";`);
  }

  const proteusNamedImports = ["ProteusSource"];
  if (adapterName) proteusNamedImports.push(adapterName);

  lines.push(`import { ${proteusNamedImports.join(", ")} } from "@lindorm/proteus";`);
  lines.push(``);
  lines.push(`export const source = new ProteusSource({`);
  lines.push(`  driver: "${driver}",`);

  if (loggerImport) {
    lines.push(`  logger: logger,`);
  } else {
    lines.push(`  logger: logger, // TODO: import or create a Logger instance`);
  }

  if (amphoraImport) {
    lines.push(`  amphora: amphora,`);
  }

  lines.push(`  entities: [join(import.meta.dirname, "entities")],`);

  if (isSql) {
    lines.push(`  migrations: [join(import.meta.dirname, "migrations")],`);
  }

  const conn = urlField(driver, configImport);
  if (conn) {
    lines.push(conn);
  } else {
    lines.push(...hardcodedConnection(driver));
  }

  lines.push(...cacheBlock(driver, effectiveCache, configImport, keyPrefix));

  lines.push(`});`);
  lines.push(``);

  // `join` only referenced when entities/migrations get scanner paths, which
  // happens on every driver — hoist the import into the top of the file.
  return `import { join } from "path";\n${lines.join("\n")}`;
};

export const PROTEUS_SQL_DRIVERS = SQL_DRIVERS;
export const PROTEUS_DB_DRIVERS = DB_DRIVERS;
export const PROTEUS_ALL_DRIVERS = [
  "postgres",
  "mysql",
  "sqlite",
  "redis",
  "mongo",
  "memory",
];
