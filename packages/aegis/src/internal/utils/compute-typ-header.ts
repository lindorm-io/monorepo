import { TOKEN_TYPE_TO_SHORT_NAME, type TokenType } from "../../constants/token-type.js";
import { AegisError } from "../../errors/index.js";
import type { BaseTokenFormat } from "../../types/header/wire-header.js";

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

/**
 * Construct the FULL media type from a bare TYP PREFIX — the kit owns this
 * because it knows its own format. `"at"` → `application/at+jwt`; an
 * absent/empty prefix → the bare conventional form (`"JWT"`). No short-name
 * lookup and no domain knowledge: the tokenType→prefix mapping is Aegis-side.
 */
export const buildMediaType = (
  prefix: string | undefined | null,
  kitFormat: KitFormat,
): string =>
  prefix
    ? `application/${prefix}${FORMAT_SUFFIX[kitFormat]}`
    : FORMAT_FALLBACK[kitFormat];

/**
 * The inverse of {@link buildMediaType} — reduce a full media type to its bare
 * prefix for handing to the wire kit (which re-wraps it). The bare conventional
 * form (`"JWT"`) and an absent typ reduce to `undefined`. Anything that is not a
 * conventional or `application/<prefix>+<fmt>` typ is a bug.
 */
export const extractTypPrefix = (
  fullTyp: string | undefined,
  kitFormat: KitFormat = "jwt",
): string | undefined => {
  if (!fullTyp || fullTyp === FORMAT_FALLBACK[kitFormat]) return undefined;

  const suffix = FORMAT_SUFFIX[kitFormat];
  if (fullTyp.endsWith(suffix)) {
    return fullTyp.slice(0, -suffix.length).replace(/^application\//, "");
  }

  throw new AegisError(`Unexpected typ header: ${fullTyp}`, {
    code: "invalid_typ_header_value",
    data: { typ: fullTyp },
    title: "Invalid Typ Header Value",
    details:
      "A typ header must be the bare conventional form (JWT) or an application/<prefix>+<format> media type.",
  });
};

export const computeTypHeader = (
  tokenType: TokenType | undefined,
  kitFormat: KitFormat,
): string => {
  if (tokenType === undefined) return FORMAT_FALLBACK[kitFormat];

  if (tokenType === "") {
    throw new AegisError("tokenType cannot be an empty string", {
      code: "invalid_token_type_value",
      title: "Invalid Token Type Value",
      details:
        "tokenType was an empty string; pass a non-empty bare type such as access_token, or omit it to use the default typ.",
    });
  }
  if (tokenType.trim() !== tokenType || /\s/.test(tokenType)) {
    throw new AegisError("tokenType cannot contain whitespace", {
      code: "invalid_token_type_value",
      data: { tokenType },
      title: "Invalid Token Type Value",
      details:
        "tokenType contains whitespace; pass a single bare type token with no leading, trailing, or interior spaces.",
    });
  }
  if (tokenType.includes("+")) {
    throw new AegisError(
      'tokenType cannot contain \'+\' — pass the bare type (e.g. "access_token"), not the full typ header (e.g. "at+jwt")',
      {
        code: "invalid_token_type_value",
        data: { tokenType },
        title: "Invalid Token Type Value",
        details:
          "tokenType contains a '+'; pass the bare type such as access_token, not a full typ header like at+jwt.",
      },
    );
  }

  const shortName =
    (TOKEN_TYPE_TO_SHORT_NAME as Record<string, string>)[tokenType] ?? tokenType;

  // Special case: id_token maps to bare "JWT", no suffix (OIDC ecosystem
  // compatibility — there is no registered structured `id+jwt` type, and an
  // id_token's consumer is the OIDC RP, which expects a plain JWT).
  if (shortName === "JWT") return "JWT";

  // A structured type carries the full media type (`application/at+jwt`); only
  // the bare conventional forms (JWT / JWS / JWE) omit the `application/` prefix.
  return `application/${shortName}${FORMAT_SUFFIX[kitFormat]}`;
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
    // Structured types are minted as `application/<short>+jwt`; strip the
    // prefix before the reverse lookup.
    const shortName = typ.slice(0, -suffix.length).replace(/^application\//, "");
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
