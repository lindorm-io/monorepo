export type GenerateSourceOptions = {
  driver: string;
  loggerImport?: string | null;
};

const SQL_DRIVERS = ["postgres", "mysql", "sqlite"];

export const generateSource = (options: GenerateSourceOptions): string => {
  const { driver, loggerImport } = options;
  const isSql = SQL_DRIVERS.includes(driver);

  const lines: Array<string> = [];

  if (loggerImport) {
    lines.push(`import { logger } from "${loggerImport}";`);
  }

  lines.push(`import { join } from "path";`);
  lines.push(`import { ProteusSource } from "@lindorm/proteus";`);
  lines.push(``);
  lines.push(`export const source = new ProteusSource({`);
  lines.push(`  driver: "${driver}",`);

  if (loggerImport) {
    lines.push(`  logger: logger,`);
  } else {
    lines.push(`  logger: logger, // TODO: import or create a Logger instance`);
  }

  lines.push(`  entities: [join(__dirname, "entities")],`);

  if (isSql) {
    lines.push(`  migrations: [join(__dirname, "migrations")],`);
  }

  switch (driver) {
    case "postgres":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 5432,`);
      lines.push(`  database: "app",`);
      break;
    case "mysql":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 3306,`);
      lines.push(`  database: "app",`);
      break;
    case "sqlite":
      lines.push(`  filename: "./data/app.db",`);
      break;
    case "redis":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 6379,`);
      break;
    case "mongo":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 27017,`);
      lines.push(`  database: "app",`);
      break;
    case "memory":
      break;
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};

export const PROTEUS_SQL_DRIVERS = SQL_DRIVERS;
export const PROTEUS_ALL_DRIVERS = [
  "postgres",
  "mysql",
  "sqlite",
  "redis",
  "mongo",
  "memory",
];
