import { B64 } from "@lindorm/b64";
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

  const raw = mapTokenHeader(options);

  // Convert Buffer fields (iv, p2s, tag) to base64url strings for JSON serialization.
  // RawTokenHeaderClaims uses Buffer for these fields; TokenHeaderClaims uses string.
  // alg is required in TokenHeaderClaims but optional in RawTokenHeaderClaims —
  // we've already validated options.algorithm above so raw.alg is guaranteed to be set.
  const claims: TokenHeaderClaims = {
    ...raw,
    alg: options.algorithm,
    iv: raw.iv ? B64.encode(raw.iv, B64U) : undefined,
    p2s: raw.p2s ? B64.encode(raw.p2s, B64U) : undefined,
    tag: raw.tag ? B64.encode(raw.tag, B64U) : undefined,
  };

  return B64.encode(JSON.stringify(claims), B64U);
};

export const decodeJoseHeader = (header: string): DecodedTokenHeader => {
  const string = B64.toString(header);
  const json = JSON.parse(string) as Partial<TokenHeaderClaims>;

  if (!json.alg || typeof json.alg !== "string") {
    throw new Error("Missing or invalid token header: alg");
  }
  // typ is OPTIONAL per RFC 7515 Section 4.1.9
  if (json.typ !== undefined && typeof json.typ !== "string") {
    throw new Error("Invalid token header: typ must be a string");
  }
  // Pass through as-is; individual Kit classes validate specific values if needed

  return json as DecodedTokenHeader;
};
