export type GenerateSourceOptions = {
  driver: string;
  loggerImport?: string | null;
};

export const IRIS_ALL_DRIVERS = ["rabbit", "kafka", "nats", "redis"];

export const generateSource = (options: GenerateSourceOptions): string => {
  const { driver, loggerImport } = options;

  const lines: Array<string> = [];

  if (loggerImport) {
    lines.push(`import { logger } from "${loggerImport}";`);
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

  lines.push(`  messages: [join(__dirname, "messages")],`);

  switch (driver) {
    case "rabbit":
      lines.push(`  url: "amqp://localhost:5672",`);
      break;
    case "kafka":
      lines.push(`  brokers: ["localhost:9092"],`);
      break;
    case "nats":
      lines.push(`  servers: "localhost:4222",`);
      break;
    case "redis":
      lines.push(`  url: "redis://localhost:6379",`);
      break;
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};
