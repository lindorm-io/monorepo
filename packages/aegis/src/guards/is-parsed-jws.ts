import type { ParsedJws, ParsedJwt } from "../types/index.js";

export const isParsedJws = <T extends Buffer | string = Buffer | string>(
  token: ParsedJwt | ParsedJws<T>,
): token is ParsedJws<T> => token.header.baseFormat === "JWS";
