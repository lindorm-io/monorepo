import type { CnfMember } from "./capabilities.js";

/**
 * ⭐ THE ONE SOURCE for the COSE confirmation (RFC 8747 §3.1): an embedded key
 * (`jwk` → COSE_Key, label 1) and a key id (`kid`, label 3).
 *
 * A member is COSE-representable IFF it has a label here. Three things follow,
 * and together they are the point of the table:
 *
 *  1. `KIT_CAPABILITIES[*].cnfMembers` for the COSE rows is DERIVED from these
 *     keys, so a member cannot be declared representable without a label.
 *  2. The `satisfies` keeps the keys inside {@link CnfMember}, so a typo is a
 *     compile error rather than a label nothing will ever look up.
 *  3. The codec (`cose/cose-key.ts`) switches EXHAUSTIVELY over
 *     {@link CoseCnfMember} in both directions, so adding a label without an
 *     encoder AND a decoder does not compile.
 *
 * ⚠ Adding a member here is not a cosmetic edit. A member the capability set
 * admits and the encoder has no branch for is the exact defect the per-member
 * refusal in `encodeCnf` exists to close: a MIXED confirmation would pass the
 * membership filter, encode only the members with branches, and mint a token that
 * claims to be bound by something it does not carry.
 *
 * ⚠ `ckt` (RFC 9679, member 5) is deliberately ABSENT. aegis derives no COSE Key
 * Thumbprint, and `jkt` is not a translation of it — RFC 7638 hashes a key's
 * canonical JSON and RFC 9679 its canonical CBOR, so the same key yields
 * different bytes. A `jkt`-bound token therefore has NO COSE form at all rather
 * than a converted one.
 */
export const COSE_CNF_LABELS = {
  jwk: 1,
  kid: 3,
} as const satisfies Partial<Record<CnfMember, number>>;

/** The confirmation members COSE can carry — the label table's own keys. */
export type CoseCnfMember = keyof typeof COSE_CNF_LABELS;

/** {@link COSE_CNF_LABELS}'s keys, in declaration order, for iteration. */
export const COSE_CNF_MEMBERS: ReadonlyArray<CoseCnfMember> = Object.keys(
  COSE_CNF_LABELS,
) as ReadonlyArray<CoseCnfMember>;
