export type GenerateSourceOptions = {
  /** Iris driver name. */
  driver: string;
  /**
   * Import path for the project logger. When provided, emits
   * `import { logger } from "<loggerImport>"` and wires `logger` into
   * IrisSource options. When omitted, the generated file carries a
   * TODO placeholder so a user can bring their own logger.
   */
  loggerImport?: string | null;
  /**
   * Import path for a typed config module (e.g. `../pylon/config.js`).
   * When provided, the generated source reads connection values from
   * `config.<driver>.url` (rabbit/redis), `config.kafka.brokers`, or
   * `config.nats.servers` instead of hard-coding localhost defaults.
   */
  configImport?: string | null;
};

export const IRIS_ALL_DRIVERS = ["rabbit", "kafka", "nats", "redis"];

const connectionField = (
  driver: string,
  configImport: string | null | undefined,
): string | null => {
  if (configImport) {
    switch (driver) {
      case "rabbit":
        return `  url: config.rabbit.url,`;
      case "kafka":
        return `  brokers: config.kafka.brokers,`;
      case "nats":
        return `  servers: config.nats.servers,`;
      case "redis":
        return `  url: config.redis.url,`;
      default:
        return null;
    }
  }

  switch (driver) {
    case "rabbit":
      return `  url: "amqp://localhost:5672",`;
    case "kafka":
      return `  brokers: ["localhost:9092"],`;
    case "nats":
      return `  servers: "localhost:4222",`;
    case "redis":
      return `  url: "redis://localhost:6379",`;
    default:
      return null;
  }
};

export const generateSource = (options: GenerateSourceOptions): string => {
  const { driver, loggerImport, configImport } = options;

  const lines: Array<string> = [];

  if (loggerImport) {
    lines.push(`import { logger } from "${loggerImport}";`);
  }

  if (configImport) {
    lines.push(`import { config } from "${configImport}";`);
  }

  lines.push(`import { join } from "path";`);
  lines.push(`import { IrisSource } from "@lindorm/iris";`);
  lines.push(``);
  lines.push(`export const source = new IrisSource({`);
  lines.push(`  driver: "${driver}",`);

  if (loggerImport) {
    lines.push(`  logger: logger,`);
  } else {
    lines.push(`  logger: logger, // TODO: import or create a Logger instance`);
  }

  lines.push(`  messages: [join(import.meta.dirname, "messages")],`);

  const conn = connectionField(driver, configImport);
  if (conn) lines.push(conn);

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};
