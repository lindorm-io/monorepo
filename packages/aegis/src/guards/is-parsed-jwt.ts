import { ParsedJws, ParsedJwt } from "../types";

export const isParsedJwt = (token: ParsedJwt | ParsedJws<any>): token is ParsedJwt =>
  token.header.baseFormat === "JWT";
