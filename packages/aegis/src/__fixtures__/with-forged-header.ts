import type { Dict } from "@lindorm/types";

/**
 * A compact token with `patch` merged over its protected header, and every other
 * segment carried over byte for byte — the shape a verifier meets when a header
 * was rewritten after issue. Read off the first segment as written, so a member
 * the typed decode would move aside stays in the forged header.
 *
 * ⛔ Imports nothing from `src/internal/` or `src/classes/`: a header forged
 * through aegis's own decoder would prove only that aegis agrees with itself.
 */
export const withForgedHeader = (token: string, patch: Dict): string => {
  const [header, ...rest] = token.split(".");
  const written = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Dict;

  return [
    Buffer.from(JSON.stringify({ ...written, ...patch })).toString("base64url"),
    ...rest,
  ].join(".");
};
