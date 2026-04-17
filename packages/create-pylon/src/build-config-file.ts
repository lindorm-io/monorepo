import type { Answers, IrisDriver, ProteusDriver } from "./types";

const proteusField = (driver: ProteusDriver): string | null => {
  if (driver === "none" || driver === "memory") return null;
  return `  proteusUrl: z.string(),`;
};

const irisField = (driver: IrisDriver): string | null => {
  switch (driver) {
    case "kafka":
      return `  irisBrokers: z.string().transform((s) => s.split(",")),`;
    case "nats":
      return `  irisServers: z.string(),`;
    case "rabbit":
    case "redis":
      return `  irisUrl: z.string(),`;
    case "none":
    default:
      return null;
  }
};

export const buildConfigFile = (answers: Answers): string => {
  const lines: Array<string> = [
    `import { configuration } from "@lindorm/config";`,
    `import { z } from "zod";`,
    ``,
    `export const config = configuration({`,
    `  server: z.object({ port: z.number() }),`,
  ];

  const proteus = proteusField(answers.proteusDriver);
  if (proteus) lines.push(proteus);

  const iris = irisField(answers.irisDriver);
  if (iris) lines.push(iris);

  lines.push(`});`, ``);

  return lines.join("\n");
};
