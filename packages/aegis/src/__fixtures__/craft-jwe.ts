import type { Dict } from "@lindorm/types";

/** A five-segment JWE whose header is ours and whose body is junk. */
export const craftJwe = (header: Dict): string =>
  [
    Buffer.from(JSON.stringify(header)).toString("base64url"),
    "junk",
    "junk",
    "junk",
    "junk",
  ].join(".");
