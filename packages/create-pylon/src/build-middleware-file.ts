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
  const unit = isSocket ? "event" : "route";

  const pylonImports: Array<string> = [];
  const imports: Array<string> = [];
  const mounts: Array<string> = [];

  if (answers.features.audit) {
    pylonImports.push(`useAuditLog`);
    // ⚠ Mounted OUTERMOST — ahead of the limiter, and ahead of everything else.
    // A middleware only records what it wraps: mounted below `useRateLimit()` it
    // would never see a 429, because the limiter rejects by throwing and the
    // throw never reaches a frame that was never entered. Denied and throttled
    // requests are the ones an auditor actually wants, and an audit log that
    // omits them is worse than none because it still looks complete. It costs a
    // rejected request nothing: the mount does no work before `next()`.
    mounts.push(`useAuditLog()`);
  }

  if (answers.features.rateLimit) {
    pylonImports.push(`useRateLimit`);
    // ⚠ Mounted before the route: a rejected request must not run the rest of
    // the chain. And with NO arguments — the window, ceiling, strategy, key and
    // skip all live on the `rateLimit` block in `src/pylon/pylon.ts`, so this
    // mount holds no second copy of the numbers free to disagree with it. That
    // makes the two inseparable: a bare mount with no block inherits no bounds
    // and throws `rate_limit_not_bounded` on every request, so `buildPylonFile`
    // must emit the block whenever this emits the mount.
    mounts.push(`useRateLimit()`);
  }

  // ONE import for the toolkit, however many mounts came off it.
  if (pylonImports.length) {
    imports.push(`import { ${pylonImports.join(", ")} } from "@lindorm/pylon";`);
  }

  imports.push(`import { ${example} } from "${examplePath}";`);
  mounts.push(example);

  const lines: Array<string> = [...imports, ``];

  if (answers.features.audit) {
    lines.push(
      `// Mounting IS the switch here too, and this one is mounted FIRST so it`,
      `// wraps everything below it — a request denied by the limiter or by an`,
      `// auth check is still recorded, with the status the client received. The`,
      `// \`audit\` block in \`src/pylon/pylon.ts\` is the policy it reads.`,
    );
  }

  if (answers.features.rateLimit) {
    lines.push(
      `// Mounting IS the switch: pylon never injects a limiter of its own, so this`,
      `// file is what rate-limits every ${unit}. The mount takes no arguments —`,
      `// its window and ceiling come from the \`rateLimit\` block in`,
      `// \`src/pylon/pylon.ts\`, and without that block it throws on every request.`,
    );
  }

  lines.push(`export const MIDDLEWARE = [${mounts.join(", ")}];`, ``);

  return lines.join("\n");
};
