import { isString } from "@lindorm/is";

/**
 * The type/subtype half of a media type: everything before the first `;`, where the
 * parameter section starts (RFC 2045 §5.1). It always matches, possibly empty, so
 * an unparameterised value folds whole.
 */
const ESSENCE = /^[^;]*/;

/**
 * The letters a media type folds. RFC 2045 §5.1 writes a type and subtype in
 * US-ASCII, so the case insensitivity RFC 7515 §4.1.9 imports from it is ASCII
 * case insensitivity.
 *
 * ⚠ NOT `String.prototype.toLowerCase`, whose full Unicode case mapping reads
 * U+212A KELVIN SIGN as an ASCII `k` and U+1E9E as U+00DF. A `typ` that is no media
 * type at all would then name one: spell the `k` of
 * `application/token-introspection+jwt` with U+212A and the well-formedness gate
 * (`assert-wire-typ.ts`) still admits it on its `+jwt` ending, so the floor would
 * match it against the introspection profile's own type while a peer folding ASCII
 * refuses the same token (pinned: `media-type-matches.test.ts`).
 */
const ASCII_UPPER = /[A-Z]/g;

const foldAsciiCase = (essence: string): string =>
  essence.replace(ASCII_UPPER, (letter) => letter.toLowerCase());

/**
 * ONE media type in the form a comparison can use — `application/` prepended where
 * the value carries no `/`, type and subtype ASCII case-folded
 * (RFC 7515 §4.1.9, RFC 2045 §5.1).
 *
 * The verify floor (`enforce-verify-floor.ts`) and the reverse lookup that names
 * a type for the token it accepted
 * (`compute-typ-header.ts#export const decodeTokenTypeFromTyp`) both decide
 * through this, so the two cannot disagree about which spellings are one type.
 *
 * ⚠ THE PARAMETER SECTION TRAVELS VERBATIM: a parameter value is case sensitive
 * (RFC 2045 §5.1), so folding the whole string would change what a parameterised
 * type means. Such a value therefore matches a bare type under no spelling — the
 * conservative answer, and no built-in profile declares one
 * (`internal/profiles/definitions/`).
 */
export const normaliseMediaType = (value: string): string =>
  `${value.includes("/") ? "" : "application/"}${value.replace(ESSENCE, foldAsciiCase)}`;

/**
 * Do two `typ` header values name the SAME MEDIA TYPE? NOT a string compare: a
 * recipient must read a value carrying no `/` as if `application/` were prepended,
 * and a media type and subtype are case insensitive (RFC 7515 §4.1.9). So
 * `at+jwt`, `application/at+jwt` and `application/AT+jwt` are one type, and
 * RFC 9068 §4 names the first two as the values an access token may carry.
 *
 * BOTH sides are normalised, so a profile declaring the short `at+jwt` matches a
 * token carrying the long form as readily as the reverse. Nothing validates a
 * profile's `typ` at registration (`internal/profiles/define-profile.ts`), so the
 * declared side is as free as the token's.
 *
 * ⚠ A NON-STRING NEVER MATCHES. The COSE `typ` (label 16) is a `passthrough`
 * registry cell (`internal/header/header-registry.ts`), so a CWT stating a CoAP
 * Content-Format integer travels as a number under the `string | undefined` this
 * takes — the declared type is not proof on that wire.
 */
export const mediaTypeMatches = (actual: string | undefined, expected: string): boolean =>
  isString(actual) && normaliseMediaType(actual) === normaliseMediaType(expected);
