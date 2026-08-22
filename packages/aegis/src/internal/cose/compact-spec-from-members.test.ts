import { SYNTHETIC_SPEC } from "../../__fixtures__/synthetic-spec.js";
import { describe, expect, test } from "vitest";
import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireLabel, wireName } from "../registry/wire-key.js";
import { compactSpecFromMembers } from "./compact-spec-from-members.js";

/**
 * THE DRIFT GUARD FOR THE COMPACT LABEL MAP, and why it needs a test of its own.
 *
 * ⚠⚠ It is UNREACHABLE FROM THE REGISTRY: its only production caller is
 * `cwt-spec.ts`'s `shapeForObject`, inside the arm that has already established
 * every member carries a label (`textKeyed.length === 0`). Delete the throw and
 * nothing else in the suite goes red — this file is the whole proof it fires.
 *
 * ⭐ It is not decorative: `compactEncode` walks the VALUE and writes an
 * unlabelled member under its own string key, so a half-labelled member set
 * reaching this builder produces a spec that disagrees with the encoder about
 * which members exist. The refusal makes a FUTURE member added without a COSE
 * label fail loudly instead of shipping a proprietary token that says less than
 * its interoperable twin.
 *
 * The members below are SYNTHETIC because the registry cannot produce the shape.
 */

const member = (
  domain: string,
  cose: ClaimMemberSpec["wire"]["cose"],
): ClaimMemberSpec => ({
  domain,
  spec: SYNTHETIC_SPEC,
  wire: { jose: wireName(domain), cose },
  codec: { kind: "text" },
  whenEmpty: "keep",
  sample: `${domain}_sample`,
});

describe("compactSpecFromMembers", () => {
  test("derives the label table from the members' own COSE cells", () => {
    // The happy path, so the refusal below is not the only thing pinned. Keyed by
    // the COSE WIRE NAME: the translator has already run by the time the byte
    // layer sees a value.
    expect(
      compactSpecFromMembers("act", [
        member("iss", wireLabel(1, "iss")),
        member("sub", wireLabel(2, "sub")),
      ]),
    ).toEqual({ claim: "act", labels: { iss: 1, sub: 2 }, nested: {} });
  });

  test("REFUSES a member that carries no COSE label, naming the claim and the member", () => {
    // A member keyed by a string NAME on COSE — legal for a top-level claim,
    // impossible inside a label map: `compactEncode` gives it its own text key
    // while the spec claims the structure is entirely labelled.
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
    // `wireAbsent` is the other way a member reaches this builder without a label,
    // asserted separately because "keyed by a name here" and "not carried here" are
    // different cells a builder could answer apart.
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
