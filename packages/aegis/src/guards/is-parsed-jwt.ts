import type { ParsedJws, ParsedJwt } from "../types/index.js";

export const isParsedJwt = (token: ParsedJwt | ParsedJws<any>): token is ParsedJwt =>
  token.header.baseFormat === "JWT";
