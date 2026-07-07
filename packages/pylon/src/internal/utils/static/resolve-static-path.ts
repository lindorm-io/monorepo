import { join, sep } from "path";
import { staticNotFound } from "./static-not-found.js";

// koa-router@14 has ALREADY percent-decoded the splat param: `%2e%2e` arrives
// as `..`, `%2F` as a literal `/`, `%00` as a raw NUL. We must therefore never
// decode again (double-decode reopens the traversal hole) and instead validate
// the decoded segments directly.
export const resolveStaticPath = (root: string, param: string | undefined): string => {
  const raw = param ?? "";

  if (raw.includes("\0")) {
    throw staticNotFound({ root, relative: raw });
  }

  // A single trailing slash is legitimate for a directory hit
  // (`nested/`) — strip it so it does not read as an empty final segment.
  // Internal empties (`a//b`) are still rejected below.
  const relative = raw.endsWith("/") ? raw.slice(0, -1) : raw;

  const segments = relative === "" ? [] : relative.split("/");

  for (const segment of segments) {
    // Reject empty (`a//b`), current/parent (`.`/`..`) and dotfiles — a leading
    // dot covers all three of the latter.
    if (segment === "" || segment.startsWith(".")) {
      throw staticNotFound({ root, relative });
    }
  }

  const absolute = join(root, ...segments);

  // Belt-and-braces: even with clean segments, assert the join stayed inside the
  // root before touching the filesystem.
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw staticNotFound({ root, relative, absolute });
  }

  return absolute;
};
