import type { Answers } from "./types.js";

export type MiddlewareTransport = "http" | "socket";

/**
 * The root `_middleware.ts` of the scanned `routes/` (http) or `listeners/`
 * (socket) directory — the chain every scanned file inherits.
 *
 * ⚠ Generated rather than copied from `templates/`, because its content depends
 * on the chosen features: pylon installs NO middleware of its own on the strength
 * of a setting, so a rate-limited scaffold has to mount `useRateLimit()` here.
 * A static template could only ever show one of the two.
 */
export const buildMiddlewareFile = (
  answers: Answers,
  transport: MiddlewareTransport,
): string => {
  const isSocket = transport === "socket";
  const example = isSocket ? "socketExampleMiddleware" : "httpExampleMiddleware";
  const examplePath = isSocket
    ? "../middleware/socket-example.js"
    : "../middleware/http-example.js";

  const imports: Array<string> = [];
  const mounts: Array<string> = [];

  if (answers.features.rateLimit) {
    imports.push(`import { useRateLimit } from "@lindorm/pylon";`);
    // ⚠ Mounted FIRST: a rejected request must not run the rest of the chain.
    // And with NO arguments — the window, ceiling, strategy, key and skip all
    // live on the `rateLimit` block in `src/pylon/pylon.ts`, so this mount holds
    // no second copy of the numbers free to disagree with it. That makes the two
    // inseparable: a bare mount with no block inherits no bounds and throws
    // `rate_limit_not_bounded` on every request, so `buildPylonFile` must emit
    // the block whenever this emits the mount.
    mounts.push(`useRateLimit()`);
  }

  imports.push(`import { ${example} } from "${examplePath}";`);
  mounts.push(example);

  const lines: Array<string> = [...imports, ``];

  if (answers.features.rateLimit) {
    lines.push(
      `// Mounting IS the switch: pylon never injects a limiter of its own, so this`,
      `// file is what rate-limits every ${isSocket ? "event" : "route"}. The mount takes no arguments —`,
      `// its window and ceiling come from the \`rateLimit\` block in`,
      `// \`src/pylon/pylon.ts\`, and without that block it throws on every request.`,
    );
  }

  lines.push(`export const MIDDLEWARE = [${mounts.join(", ")}];`, ``);

  return lines.join("\n");
};
