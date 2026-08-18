import { describe, expect, test } from "vitest";
import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireLabel, wireName } from "../registry/wire-key.js";
import { compactSpecFromMembers } from "./compact-spec-from-members.js";

/**
 * THE DRIFT GUARD FOR THE COMPACT LABEL MAP — the one refusal in this file, and
 * the reason it needs a test of its own.
 *
 * ⚠⚠ IT IS UNREACHABLE FROM THE REGISTRY TODAY, WHICH IS EXACTLY WHY NOTHING
 * PROVED IT STILL FIRES. Its only production caller is
 * `internal/cose/cwt-spec.ts`'s `shapeForObject`, inside the arm that has ALREADY
 * established every member carries a label (`textKeyed.length === 0`) — so no
 * declaration the registry can currently hold reaches the throw. A sabotage probe
 * deleted it and the whole suite stayed green.
 *
 * ⭐ THE GUARD IS NOT DECORATIVE. `compactEncode` walks the value and writes an
 * unlabelled member under its own STRING key, so a half-labelled member set
 * reaching this builder would produce a spec that silently disagrees with the
 * encoder about which members exist. The refusal exists so a FUTURE member added
 * without a COSE label fails loudly instead of shipping a proprietary token that
 * says less than its interoperable twin. A guard for a future mistake is worth
 * exactly what its test is worth.
 *
 * ⚠ ITS SIBLING `cose_mixed_member_keying` IS PINNED (`cwt-spec.test.ts`), which
 * is what made this gap conspicuous rather than invisible: two guards on one
 * question, one held and one not.
 *
 * The members below are SYNTHETIC and deliberately so — the registry cannot
 * produce the shape, so a test that waited for it to would be a test that never
 * ran.
 */

const member = (
  domain: string,
  cose: ClaimMemberSpec["wire"]["cose"],
): ClaimMemberSpec => ({
  domain,
  wire: { jose: wireName(domain), cose },
  codec: { kind: "text" },
  whenEmpty: "keep",
  sample: `${domain}_sample`,
});

describe("compactSpecFromMembers", () => {
  test("derives the label table from the members' own COSE cells", () => {
    // The happy path, so the refusal below is not the only thing the builder is
    // known to do. Keyed by the COSE WIRE NAME, not the domain name — the
    // translator has already run by the time the byte layer sees a value.
    expect(
      compactSpecFromMembers("act", [
        member("iss", wireLabel(1, "iss")),
        member("sub", wireLabel(2, "sub")),
      ]),
    ).toEqual({ claim: "act", labels: { iss: 1, sub: 2 }, nested: {} });
  });

  test("REFUSES a member that carries no COSE label, naming the claim and the member", () => {
    // A member keyed by a string NAME on COSE — legal for a top-level claim
    // (`acr` is), impossible inside a label map: `compactEncode` would give it its
    // own text key while the spec claims the structure is entirely labelled, so
    // the two halves of one encoding would disagree.
    expect(() =>
      compactSpecFromMembers("act", [
        member("iss", wireLabel(1, "iss")),
        member("surprise", wireName("surprise")),
      ]),
    ).toThrow(
      expect.objectContaining({
        name: "CoseError",
        code: "cose_unlabelled_compact_member",
        data: { claim: "act", member: "surprise" },
      }) as unknown as Error,
    );
  });

  test("REFUSES a member the wire cannot carry at all, by the same rule", () => {
    // `wireAbsent` is the other way a member reaches this builder without a
    // label. It is asserted separately because the two cells are DIFFERENT facts —
    // "keyed by a name here" and "not carried here" — and a builder that
    // discriminated on `kind` rather than on the label would answer them apart.
    expect(() =>
      compactSpecFromMembers("subjectId", [
        member("format", wireLabel(0, "format")),
        member("gone", { kind: "absent", reason: "no COSE form" }),
      ]),
    ).toThrow(
      expect.objectContaining({
        code: "cose_unlabelled_compact_member",
        data: { claim: "subjectId", member: "gone" },
      }) as unknown as Error,
    );
  });
});
