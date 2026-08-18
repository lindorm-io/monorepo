import { CoseError } from "../../errors/index.js";
import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireKeyLabel, wireKeyName } from "../registry/wire-key.js";
import type { CompactSpec } from "./compact-map.js";

/**
 * A {@link CompactSpec} DERIVED from a declared member set — the bridge between
 * the registry's member declarations and the label-map walker in
 * `compact-map.ts`.
 *
 * ⚠ IT REPLACES A HAND-WRITTEN TABLE, and the table it replaced is the reason it
 * exists. `internal/cose/act-claim.ts` held `ACT_SPEC = { labels: { iss: 1,
 * sub: 2, aud: 3, client_id: 4, act: 5 }, nested: { act: … } }` beside a registry
 * that now states every one of those five facts itself. Two tables for one
 * structure is two places a label can be written, and the wire is decided by
 * whichever one the byte layer happens to read.
 *
 * ⚠ THE LABELS ARE KEYED BY THE COSE WIRE NAME, NOT THE DOMAIN NAME. The
 * translator has already run by the time the byte layer sees a value, so the
 * object it hands over is spelled in the wire's vocabulary (`sub`, not
 * `subject`). Keying by the domain name would produce a spec that matches
 * nothing and an actor map with no members at all.
 *
 * ⭐ THE SELF-REFERENCE IS THE THUNK, EVALUATED LAZILY. `CompactSpec.nested`
 * takes `spec: () => CompactSpec`, so a member set naming ITSELF (RFC 8693's
 * recursive actor chain) builds one level per level of actual data and
 * terminates with the value rather than with the declaration. Deriving the
 * child spec eagerly here would not terminate at all.
 */
export const compactSpecFromMembers = (
  claim: string,
  members: ReadonlyArray<ClaimMemberSpec>,
): CompactSpec => {
  const labels: Record<string, number> = {};
  const nested: Record<string, { array?: boolean; spec: () => CompactSpec }> = {};

  for (const member of members) {
    const name = wireKeyName(member.wire.cose);
    const label = wireKeyLabel(member.wire.cose);

    if (name !== undefined && label !== undefined) {
      labels[name] = label;

      const children =
        member.codec.kind === "object"
          ? member.codec.children
          : member.codec.kind === "array"
            ? member.codec.of?.children
            : undefined;

      if (children !== undefined) {
        nested[name] = {
          array: member.codec.kind === "array",
          spec: () => compactSpecFromMembers(claim, children()),
        };
      }

      continue;
    }

    // A member with no integer label has no place in a label map: `compactEncode`
    // walks the label table, so an undeclared entry would be DROPPED from a
    // signed token in silence. The caller (`cwt-spec.ts`) only reaches this
    // builder for a set it has already established is entirely labelled, so this
    // is the drift guard for that establishment rather than a case with a policy.
    throw new CoseError("Unlabelled member in a compact COSE structure", {
      code: "cose_unlabelled_compact_member",
      data: { claim, member: member.domain },
      title: "Unlabelled Member In A Compact COSE Structure",
      details:
        "The claim registry declares a structured claim whose members are keyed by integer COSE labels, but one of them carries no label, so the compact encoding would drop it from a signed token.",
    });
  }

  return { claim, labels, nested };
};
