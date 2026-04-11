import { TOKEN_TYPE_TO_SHORT_NAME, TokenType } from "../../constants/token-type";
import { BaseTokenFormat } from "../../types/header";

export type KitFormat = "jwt" | "jws" | "jwe";

const FORMAT_FALLBACK: Record<KitFormat, string> = {
  jwt: "JWT",
  jws: "JWS",
  jwe: "JWE",
};

const FORMAT_SUFFIX: Record<KitFormat, string> = {
  jwt: "+jwt",
  jws: "+jws",
  jwe: "+jwe",
};

export const computeTypHeader = (
  tokenType: TokenType | undefined,
  kitFormat: KitFormat,
): string => {
  if (tokenType === undefined) return FORMAT_FALLBACK[kitFormat];

  if (tokenType === "") {
    throw new Error("tokenType cannot be an empty string");
  }
  if (tokenType.trim() !== tokenType || /\s/.test(tokenType)) {
    throw new Error("tokenType cannot contain whitespace");
  }
  if (tokenType.includes("+")) {
    throw new Error(
      'tokenType cannot contain \'+\' — pass the bare type (e.g. "access_token"), not the full typ header (e.g. "at+jwt")',
    );
  }

  const shortName =
    (TOKEN_TYPE_TO_SHORT_NAME as Record<string, string>)[tokenType] ?? tokenType;

  // Special case: id_token maps to bare "JWT", no suffix (OIDC ecosystem compatibility)
  if (shortName === "JWT") return "JWT";

  return `${shortName}${FORMAT_SUFFIX[kitFormat]}`;
};

/**
 * Inverse of computeTypHeader: given a typ header and kit format, derive the
 * tokenType. Returns undefined if the typ is the bare format fallback (ambiguous)
 * or has no recoverable tokenType.
 */
export const decodeTokenTypeFromTyp = (
  typ: string | undefined,
  kitFormat: KitFormat,
): string | undefined => {
  if (!typ) return undefined;
  if (typ === FORMAT_FALLBACK[kitFormat]) return undefined;

  const suffix = FORMAT_SUFFIX[kitFormat];
  if (typ.endsWith(suffix)) {
    const shortName = typ.slice(0, -suffix.length);
    // Reverse lookup known short names to their canonical tokenType
    for (const [tokenType, known] of Object.entries(TOKEN_TYPE_TO_SHORT_NAME)) {
      if (known === shortName) return tokenType;
    }
    return shortName;
  }

  return undefined;
};

/**
 * Derive the base token format (JWT, JWS, JWE) from a JOSE `typ` header value.
 * Returns undefined when the typ is absent or unrecognized. Handles both the
 * bare conventional forms ("JWT", "JWS", "JOSE", "JWE") and the short-name-
 * plus-suffix forms ("at+jwt", "rt+jws", "dpop+jwe", etc.).
 */
export const getBaseFormat = (typ: string | undefined): BaseTokenFormat | undefined => {
  if (!typ) return undefined;

  // Bare forms
  if (typ === "JWT") return "JWT";
  if (typ === "JWS" || typ === "JOSE") return "JWS";
  if (typ === "JWE") return "JWE";

  // Suffix forms
  if (typ.endsWith("+jwt")) return "JWT";
  if (typ.endsWith("+jws")) return "JWS";
  if (typ.endsWith("+jwe")) return "JWE";

  return undefined;
};
