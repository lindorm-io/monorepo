import { isEmpty } from "@lindorm/is";

/**
 * DEMAND presence — is there a value here a demand can bite on? Backs
 * `required`, `atLeastOneOf` and `requiredWhen`, in whichever direction the rule
 * declares.
 *
 * Empty is `undefined`, `null`, `""`, `[]`, `{}` — and a zero-`size` `Map` or
 * `Set`. `0` and `false` are values. An `aud: []` names no audience, a `cnf: {}`
 * binds to no key and an `authorization_details: []` authorises nothing, so none
 * of them satisfies a demand for that claim — the single predicate this replaces
 * counted `undefined | null | ""` alone and admitted all three.
 *
 * ⚠ NOT the complement of {@link isClaimOmitted}. The two notions are named
 * separately on purpose — see the vocabulary table in `./index.ts`.
 *
 * ⚠ A BYTE STRING IS ALWAYS SATISFYING, zero-length included — measured:
 * `isClaimSatisfied(Buffer.alloc(0))` and `isClaimSatisfied(new Uint8Array(0))`
 * are both `true`. That is deliberate and it matches the registry, which states
 * the same verdict for the same question ("neither is a zero-length Buffer",
 * {@link import("../../registry/param-spec.js").ParamSpec.whenEmpty}):
 * `@lindorm/is` `isEmpty` declines to answer for a buffer because "empty" there
 * would mean `byteLength`, which is a different question from an empty
 * container. A zero-length byte string is a value the issuer wrote.
 *
 * ⚠ `isEmpty` reads an object by its OWN keys and is prototype-based, so
 * `isEmpty(new Date())` is `false` and a `required: ["expiresAt"]` reads a
 * `Date` as satisfied.
 */
export const isClaimSatisfied = (value: unknown): boolean => !isEmpty(value);
