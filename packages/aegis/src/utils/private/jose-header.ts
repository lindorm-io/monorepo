import { B64 } from "@lindorm/b64";
import { isBuffer } from "@lindorm/is";
import {
  B64U,
  TOKEN_HEADER_ALGORITHMS,
  TOKEN_HEADER_TYPES,
} from "../../constants/private";
import { DecodedTokenHeader, TokenHeaderClaims, TokenHeaderOptions } from "../../types";
import { mapTokenHeader } from "./token-header";

export const encodeJoseHeader = (options: TokenHeaderOptions): string => {
  if (!options.algorithm) {
    throw new Error("Algorithm is required");
  }
  if (!TOKEN_HEADER_ALGORITHMS.includes(options.algorithm)) {
    throw new Error(`Invalid algorithm: ${options.algorithm}`);
  }
  if (!options.headerType) {
    throw new Error("Header type is required");
  }
  if (!TOKEN_HEADER_TYPES.includes(options.headerType)) {
    throw new Error(`Invalid header type: ${options.headerType}`);
  }
  if (!options.keyId) {
    throw new Error("Key ID is required");
  }

  const claims = mapTokenHeader(options);

  for (const [key, value] of Object.entries(claims)) {
    if (!isBuffer(value)) continue;
    (claims as any)[key] = B64.encode(value);
  }

  return B64.encode(JSON.stringify(claims), B64U);
};

export const decodeJoseHeader = (header: string): DecodedTokenHeader => {
  const string = B64.toString(header);
  const json = JSON.parse(string) as Partial<TokenHeaderClaims>;

  if (!json.alg) {
    throw new Error("Missing token header: alg");
  }
  if (!TOKEN_HEADER_ALGORITHMS.includes(json.alg)) {
    throw new Error(`Invalid token header: alg: ${json.alg}`);
  }
  // typ is OPTIONAL per RFC 7515 Section 4.1.9
  if (json.typ !== undefined && typeof json.typ !== "string") {
    throw new Error("Invalid token header: typ must be a string");
  }
  // Pass through as-is; individual Kit classes validate specific values if needed

  return json as DecodedTokenHeader;
};
