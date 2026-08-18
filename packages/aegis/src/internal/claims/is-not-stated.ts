import { isNull, isUndefined } from "@lindorm/is";

/**
 * ⭐⭐ THE BOUNDARY BETWEEN "NOT STATED" AND "CONTRADICTS THE DECLARATION" — the
 * ONE place the translator decides which of the two a value is, and therefore the
 * one place that decides whether a value is OMITTED or REFUSED.
 *
 * The translator has exactly two dispositions for a value it will not carry, and
 * they are opposite in kind:
 *   - NOT STATED — the position holds no statement. It is omitted, on both
 *     directions, and nothing is reported. This predicate is that test.
 *   - CONTRADICTS — the position holds a statement the registry's declared shape
 *     cannot be reconciled with. A DECLARED STRUCTURE refuses it
 *     (`internal/claims/translate.ts`); a leaf codec still drops it (see the
 *     residue note below).
 *
 * ⚠⚠ `null` IS ABSENCE, NOT A MALFORMED VALUE — the ruling this predicate exists
 * to hold. `AegisProfileAddress` declares every member `string | null`, and a
 * caller handing aegis a database row must not have to strip the nulls out of it
 * first; so `null` at a position means the position was not stated, and it is
 * omitted rather than refused. Without this line the structure refusal below
 * would turn the ordinary shape of a nullable column into a thrown error.
 *
 * ⚠ `undefined` IS THE SAME ANSWER, and it is the older half of the rule: it is
 * how absence has always been spelled inside this package, and neither JSON nor
 * CBOR can express it, so on the read side it can only come from a caller's own
 * dict at a vocabulary door.
 *
 * ⚠⚠ `""` IS NOT ABSENCE AND MUST NOT BE ADDED HERE. An empty string is a stated
 * empty string — a text codec accepts it — and whether it rides is decided by the
 * registry's `whenEmpty` column, on the WRITE side only
 * ({@link import("../registry/param-spec.js").ParamSpec.whenEmpty}). Folding it
 * into this predicate would delete that column's only consumer and would rewrite
 * a foreign token's empty member into an absence, which is aegis reporting that
 * an issuer said nothing where the issuer said "empty". The same goes for `[]`
 * and `{}`.
 *
 * --- WHY THIS IS A FOURTH PRESENCE NOTION AND NOT ONE OF THE THREE ---
 *
 * `internal/utils/rules/index.ts` names three, and this is none of them:
 *   - `isClaimOmitted` is `=== undefined` — it answers "did the author name this
 *     key?", so a `null` an author WROTE is present to it. That is right for
 *     `forbidden`, which is a ceiling on the issuer's vocabulary, and wrong here.
 *   - `isClaimSatisfied` is `!isEmpty` — `""`, `[]`, `{}` and a zero-`size`
 *     `Map`/`Set` are all absent to it. That is right for `required`, which asks
 *     whether a demand has anything to bite on, and wrong here for exactly the
 *     reason the `""` note above gives.
 *   - `$exists` (`@lindorm/match`) is a profile author's null test, not ours.
 * ⇒ The three answer POLICY questions about a claim bag. This one answers a CODEC
 * question about a single position, which is why it lives beside the translator
 * rather than in the rule layer — but it is named in that same table, so a reader
 * holding one notion is told about the other three.
 *
 * ⛔⛔ `cnf` MEMBERS ARE **EXEMPT** FROM THIS PREDICATE, AND THE EXEMPTION IS
 * LOAD-BEARING. `internal/claims/translate.ts`'s `walkConfirmation` asks
 * `=== undefined` instead, on both its declared and its tail arm, so a null
 * confirmation member falls through to the member refusal rather than being
 * omitted. Measured on the build that let `cnf` take the carve-out, with a
 * control:
 *   `mint("cwt", { thumbprint: JKT,  keyId: KID })`  REFUSE `cose_cnf_unsupported`
 *   `mint("cwt", { thumbprint: null, keyId: KID })`  MINTED, verified with NO PROOF
 *   `mint("cwt", { keyId: KID })`                    MINTED, BYTE-IDENTICAL
 * The erasure happens in `domainToWire` BEFORE the COSE fail-closed guard runs,
 * and that guard asks `cnf[member] !== undefined` (`internal/cose/cose-key.ts`) —
 * so an already-erased `jkt` is not "unrepresentable on COSE", it is nothing.
 * RFC 9449 §6.1 types the member, and by MUST: "The value of the jkt member MUST
 * be the base64url encoding (as defined in [RFC7515]) of the JWK SHA-256
 * Thumbprint (according to [RFC7638]) of the DPoP public key (in JWK format) to
 * which the access token is bound." So `jkt: null` CONTRADICTS the member's
 * declared shape; and `cnf` is the one claim where "erased" and "absent" must
 * never become indistinguishable, because that is precisely the downgrade.
 * ⚠ THE CITATION IS 9449, NOT RFC 7800 §3.1, which these notes said for a while.
 * §3.1 defines the `cnf` CONTAINER and names `jwk`, `jwe` and `jku`; RFC 7800
 * mentions a thumbprint exactly once outside its references, as a value some
 * applications may use for `kid`. Different member, different section.
 * `internal/claims/cnf-members.ts` has cited RFC 9449 §6.1 for this member all
 * along — the declaration site was right and the notes about it drifted.
 *
 * ⚠⚠ `undefined` IS STILL ABSENCE HERE, AND THAT ASYMMETRY IS LOAD-BEARING — it
 * is not the same fault under a second spelling. `null` is reachable from BOTH
 * wires: RFC 8259 §3 makes it one of JSON's three literal names, and RFC 8949 §3.3
 * assigns it CBOR simple value 22 — so a stranger's token can state it and a
 * caller's bag can hold it. `undefined` is reachable from NEITHER: JSON cannot
 * express it at all, and although CBOR can (simple value 23, same table), the COSE
 * `cnf` carries only `jwk` (label 1) and `kid` (label 3), neither of which the
 * DPoP gate reads. So `{ jwk: undefined, kid }` minting on the `kid` alone leaves
 * no wire that could deliver the hazard.
 * ⇒ Do not generalise this predicate over `cnf` "for consistency". The
 * inconsistency is the security property.
 *
 * ⛔ THE RESIDUE, STATED RATHER THAN IMPLIED — and it is NOT uniform, which an
 * earlier version of this note claimed. A value contradicting a LEAF codec
 * (`text`, `int`, `date`, `bool`, `bstr`, an array of strings) is disposed of
 * FOUR ways, measured through the vocabulary doors:
 *
 *              write                              read
 *   CLAIM      CARRIED — `Aegis.toWire(           dropped — `Aegis.toDomain(
 *              { subject: 42 })` → `{"sub":42}`   { sub: 42 })` → no claims
 *   MEMBER     dropped — `Aegis.toWire(           dropped — `Aegis.toDomain(
 *              { act: { subject: 42 } })`         { act: { sub: 42 } })`
 *              → `{"act":{}}`                     → `{ act: {} }`
 *
 * So the two LEVELS agree on the read side and disagree on the write side: a
 * top-level leaf claim reaches a signed wire with no codec guard at all, which is
 * the hole `encodeMember`'s derived probe closes one level in and `domainToWire`
 * does not. Only a DECLARED STRUCTURE refuses, at every level and in both
 * directions. Closing the leaf half changes what a read of every registered claim
 * reports; it is filed with the measurement in `TODO-MONOREPO.md`, and
 * `internal/claims/translate.ts` states the same fact at the two lines that
 * cause it.
 */
export const isNotStated = (value: unknown): value is null | undefined =>
  isUndefined(value) || isNull(value);
