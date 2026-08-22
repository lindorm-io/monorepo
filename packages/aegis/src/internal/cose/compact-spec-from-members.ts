import { CoseError } from "../../errors/index.js";
import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireKeyLabel, wireKeyName } from "../registry/wire-key.js";
import type { CompactSpec } from "./compact-map.js";

/**
 * A {@link CompactSpec} DERIVED from a declared member set — the bridge between
 * the registry's member declarations and the label-map walker in `compact-map.ts`.
 * A second, hand-written table for the same structure is a second place a label
 * can be written, with the wire decided by whichever one the byte layer reads.
 *
 * ⚠ THE LABELS ARE KEYED BY THE COSE WIRE NAME, NOT THE DOMAIN NAME: the
 * translator has already run, so the object handed over is spelled `sub`, not
 * `subject`. Keying by the domain name produces a spec that matches nothing and
 * an actor map with no members at all.
 *
 * ⭐ The self-reference is the THUNK, evaluated lazily. `CompactSpec.nested` takes
 * `spec: () => CompactSpec`, so a member set naming ITSELF (RFC 8693 §4.1) builds
 * one level per level of DATA and terminates with the value. Deriving the child
 * spec eagerly does not terminate.
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

    // A member with no integer label has no place in a label map. `cwt-spec.ts`
    // only reaches this builder for a set it has already established is entirely
    // labelled, so this is the drift guard for that establishment.
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
