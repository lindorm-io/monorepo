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
 * multiple Proteus drivers are scaffolded. The middleware lazily attaches
 * each non-primary source to `ctx.<driver>` via `@lindorm/utils#lazyFactory`,
 * matching the pattern pylon's internal dependencies middleware uses for the
 * primary `ctx.proteus` binding.
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
    `import { lazyFactory } from "@lindorm/utils";`,
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
    ` * Pylon middleware that mounts the non-primary Proteus sources on the`,
    ` * request context as \`ctx.<driver>\`. Use via pylon options:`,
    ` *`,
    ` *     new Pylon({ httpMiddleware: [attachSourcesMiddleware] })`,
    ` */`,
    `export const attachSourcesMiddleware: ServerHttpMiddleware = async (ctx, next) => {`,
  );

  for (const driver of extras) {
    lines.push(
      `  lazyFactory(ctx, "${driver}", () =>`,
      `    ${driver}Source.session({ logger: ctx.logger, context: ctx }),`,
      `  );`,
    );
  }

  lines.push(`  await next();`, `};`, ``);

  return lines.join("\n");
};
