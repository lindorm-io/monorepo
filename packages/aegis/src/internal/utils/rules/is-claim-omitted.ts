/**
 * VOCABULARY presence — did the author not name this key at all? Backs
 * `forbidden` and every shape rule's entry guard.
 *
 * `forbidden` reads presence STRICTLY, and the reason differs per direction:
 *   - verify — `=== undefined` is EXACT. Neither JSON nor CBOR can express
 *     `undefined`, so every key a token carries has a non-`undefined` value, and
 *     no emission prune runs on a token being read. "The token carries this key"
 *     is precisely what `forbidden` asks.
 *   - mint — `forbidden` is a ceiling on the ISSUER'S VOCABULARY, not on wire
 *     bytes. An issuer writing `nonce: ""` onto a logout token is stating a
 *     nonce; that the emission prune would have swept that particular claim up
 *     (`internal/utils/normalise-claims.ts`) is luck of the registry's
 *     `whenEmpty` cell rather than a decision about the rule, and telling the
 *     issuer is the point. The eleven `whenEmpty: "keep"` claims get no such
 *     luck at all.
 *
 * ⚠ NOT the complement of {@link isClaimSatisfied}, and `=== undefined` rather
 * than `Object.hasOwn` — both stated with their reasons in `./index.ts`.
 *
 * A type PREDICATE, so a guard that returns on an omitted claim narrows the
 * value away for the rest of the block — which is what lets a call site read
 * presence through this instead of a truthiness test it reached for to get the
 * narrowing. {@link isClaimSatisfied} cannot be one: `""`, `[]` and `{}` are
 * values of their types, not types to exclude.
 */
export const isClaimOmitted = (value: unknown): value is undefined => value === undefined;
