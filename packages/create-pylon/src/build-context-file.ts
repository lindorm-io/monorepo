import type { Answers, ProteusDriver } from "./types.js";
import { PROTEUS_PRIMARY_PRIORITY } from "./types.js";

const pickPrimary = (drivers: ReadonlyArray<ProteusDriver>): ProteusDriver | null => {
  for (const d of PROTEUS_PRIMARY_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return null;
};

const buildContextExtension = (drivers: ReadonlyArray<ProteusDriver>): Array<string> => {
  if (drivers.length < 2) return [];

  const primary = pickPrimary(drivers);
  const extras = drivers.filter((d) => d !== primary);
  if (extras.length === 0) return [];

  const lines: Array<string> = [`type ExtraSources = {`];
  for (const driver of extras) {
    lines.push(`  ${driver}?: IProteusSession;`);
  }
  lines.push(`};`, ``);
  return lines;
};

export const buildContextFile = (answers: Answers): string => {
  const drivers = answers.proteusDrivers;
  const hasExtras = drivers.length >= 2;

  const lines: Array<string> = [
    `import type {`,
    `  PylonHandler,`,
    `  PylonHttpContext,`,
    `  PylonHttpMiddleware,`,
    `  PylonSocketContext,`,
    `  PylonSocketMiddleware,`,
    `} from "@lindorm/pylon";`,
  ];

  if (hasExtras) {
    lines.push(`import type { IProteusSession } from "@lindorm/proteus";`);
  }

  lines.push(`import type { z, ZodType } from "zod";`, ``);

  lines.push(...buildContextExtension(drivers));

  const extend = hasExtras ? " & ExtraSources" : "";

  lines.push(
    `export type ServerHttpContext<Data = any> = PylonHttpContext<Data>${extend};`,
    ``,
    `export type ServerSocketContext<Payload = any> = PylonSocketContext<Payload>${extend};`,
    ``,
    `export type ServerHttpMiddleware<C extends ServerHttpContext = ServerHttpContext> =`,
    `  PylonHttpMiddleware<C>;`,
    ``,
    `export type ServerSocketMiddleware<C extends ServerSocketContext = ServerSocketContext> =`,
    `  PylonSocketMiddleware<C>;`,
    ``,
    `// TODO: extend Data / State / Payload here to match your application's shape.`,
    `export type ServerHandler<`,
    `  Schema extends ZodType = ZodType<any>,`,
    `  Body = any,`,
    `> = PylonHandler<ServerHttpContext<z.infer<Schema>>, Body>;`,
    ``,
    `export type ServerSocketHandler<Schema extends ZodType = ZodType<any>> =`,
    `  PylonSocketMiddleware<ServerSocketContext<z.infer<Schema>>>;`,
    ``,
  );

  return lines.join("\n");
};
