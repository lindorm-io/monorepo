import type { Answers, ProteusDriver } from "./types.js";
import { PROTEUS_PRIMARY_PRIORITY } from "./types.js";

const pickPrimary = (drivers: ReadonlyArray<ProteusDriver>): ProteusDriver | null => {
  for (const d of PROTEUS_PRIMARY_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return null;
};

/**
 * Returns the generated content for `src/middleware/attach-sources.ts` when
 * multiple Proteus drivers are scaffolded. Each non-primary source is wired
 * via the public `createAttachProteusSourceMiddleware` from `@lindorm/pylon`,
 * which lazily attaches `ctx.<driver>` with per-request logger, hook metadata
 * and signal (HTTP only).
 *
 * Returns `null` when only 0-1 drivers are selected (no middleware needed).
 */
export const buildAttachSourcesFile = (answers: Answers): string | null => {
  const drivers = answers.proteusDrivers;
  if (drivers.length < 2) return null;

  const primary = pickPrimary(drivers);
  const extras = drivers.filter((d) => d !== primary);
  if (extras.length === 0) return null;

  const lines: Array<string> = [
    `import { createAttachProteusSourceMiddleware } from "@lindorm/pylon";`,
    `import type { ServerHttpMiddleware } from "../types/context.js";`,
  ];

  for (const driver of extras) {
    lines.push(
      `import { source as ${driver}Source } from "../proteus/${driver}/source.js";`,
    );
  }

  lines.push(
    ``,
    `/**`,
    ` * Pylon middleware instances that mount the non-primary Proteus sources on`,
    ` * the request context as \`ctx.<driver>\`. Each entry is produced by the`,
    ` * public \`createAttachProteusSourceMiddleware\` factory from \`@lindorm/pylon\`.`,
    ` *`,
    ` * Use via pylon options:`,
    ` *`,
    ` *     new Pylon({ httpMiddleware: [...attachSourcesMiddlewares] })`,
    ` */`,
    `export const attachSourcesMiddlewares: Array<ServerHttpMiddleware> = [`,
  );

  for (const driver of extras) {
    lines.push(
      `  createAttachProteusSourceMiddleware({ key: "${driver}", source: ${driver}Source }),`,
    );
  }

  lines.push(`];`, ``);

  return lines.join("\n");
};
