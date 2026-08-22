import type { IKryptos } from "@lindorm/kryptos";
import type { CweEncryptOptions, JweEncryptOptions } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { EncryptContentInput, TokenWire } from "../wire/token-wire.js";
import type { AegisDeps } from "./aegis-deps.js";
import { nestedTokenContent } from "./nested-token-content.js";

/**
 * The aegis-only half, intersected with the encrypting kits' own option type —
 * the same shape {@link EncryptContentInput} has, one step further out. Whatever
 * the caller states in the encrypt envelope reaches the outer through the
 * rest-spread below; what mint chooses to HAND this composition is mint's own
 * decision and is stated there.
 */
export type EncryptOuterInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /** The signed inner token, as its own wire's native serialisation. */
  inner: string;
  /**
   * The INNER token's bare typ PREFIX. Distinct from the envelope's own
   * `tokenType`: this one describes the token being sealed, and whether the outer
   * repeats it is {@link TokenWire.nestedTokenTyp}'s call, not the caller's.
   */
  innerTokenType: string | undefined;
} & JweEncryptOptions &
  CweEncryptOptions;

/**
 * Sign-then-encrypt: wrap an already-signed token in its own wire's encrypting
 * outer. NOT a wire operation — a COMPOSITION over one, written once for both
 * wires, so the nested-token declaration cannot be spelled differently in two
 * places.
 *
 * Everything that genuinely differs is a declared value on the wire: how a token
 * string becomes sealable content (`decodeToken`), what the outer declares its
 * plaintext to be (`nestedTokenCty`), and whether the outer carries the inner's
 * type (`nestedTokenTyp`).
 *
 * The two `header`/`tokenType` entries below are the composition's OWN
 * statements, written after the spread so they cannot be silently displaced:
 * the nested-token cty is what makes a reader treat the plaintext as a token,
 * and the outer's type is the wire's decision rather than the envelope's.
 */
export const encryptOuter = (
  wire: TokenWire,
  { kryptos, deps, inner, innerTokenType, ...options }: EncryptOuterInput,
): string => {
  // The SAME resolution `aegis.encrypt` runs over a token it is handed, so the
  // two entry points cannot declare the same nesting differently. `undefined`
  // cannot occur here in practice — this composition only ever wraps a claims
  // token this wire just minted — but the fallback keeps the seal total rather
  // than asserting a shape from one layer up.
  const nested = nestedTokenContent(wire, inner);

  const input: EncryptContentInput = {
    kryptos,
    deps,
    content: nested?.content ?? wire.decodeToken(inner),
    ...options,
    // The outer DECLARES a nested token, so the read side reconstructs the
    // plaintext to the inner token rather than to whatever value shape the bytes
    // resemble (RFC 7519 §5.2, RFC 9052 §3.1). Written AFTER the spread: on this
    // path the declaration is the composition's own statement about a token it
    // produced, not a default for the caller to override.
    header: { ...options.header, cty: nested?.cty ?? options.header?.cty },
    tokenType: wire.nestedTokenTyp === "inner" ? innerTokenType : undefined,
  };

  assertWireInput(wire.dispositions.encryptContent, input, {
    format: wire.encryptedFormat,
    operation: "encryptContent",
  });

  return wire.encryptContent(input);
};
