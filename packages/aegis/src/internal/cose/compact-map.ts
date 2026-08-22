import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";

/**
 * A spec for compacting a fixed-member object to an integer-keyed CBOR map and
 * back — the proprietary COSE encoding of the structured claims, opt-out via
 * `proprietary: false`.
 *
 * ⚠ Every spec is DERIVED from the registry's declared member set
 * (`compact-spec-from-members.ts`), never hand-written, so a label is written
 * down once and the byte layer cannot disagree with the registry about it.
 */
export type CompactSpec = {
  /**
   * The CLAIM this spec describes, carried so a refusal can name it. Read only by
   * the duplicate-key refusal in {@link compactDecode}, which sits below the
   * translator and has no other way to say which claim a malformed map is.
   */
  claim: string;
  labels: Readonly<Record<string, number>>;
  nested?: Readonly<Record<string, { array?: boolean; spec: () => CompactSpec }>>;
};

/**
 * The nested spec for one field — resolved with `Object.hasOwn`, NEVER through
 * the prototype chain.
 *
 * ⛔ `field` is caller- and producer-controlled because the walk is over the
 * VALUE, so `spec.nested?.[field]` resolves `toString`/`constructor`/`valueOf` to
 * `Object.prototype`'s own members and `nested.spec()` throws a bare `TypeError`
 * — at mint, and out of `aegis.parse`, which reads the payload before any
 * signature is checked. An open member set makes a prototype name a legal member,
 * so the key is not theoretical. The `spec.labels` lookup below guards the same
 * way: two lookups, one rule.
 */
const nestedFor = (
  spec: CompactSpec,
  field: string,
): { array?: boolean; spec: () => CompactSpec } | undefined =>
  spec.nested !== undefined && Object.hasOwn(spec.nested, field)
    ? spec.nested[field]
    : undefined;

export const compactEncode = (
  obj: Dict,
  spec: CompactSpec,
): Map<number | string, unknown> => {
  const map = new Map<number | string, unknown>();

  for (const [field, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    // `Object.hasOwn`, never `in`: the field names come from a caller's or a
    // producer's structure, so `constructor` / `toString` would otherwise resolve
    // through `Object.prototype` and be compacted under a label nobody declared.
    //
    // ⚠ The walk is over the VALUE, not `spec.labels`: walking the table drops a
    // member the value carries and the table does not — silently, from a signed
    // token, in `proprietary` mode only, while the interoperable encoding of the
    // same claim keeps it. An unlabelled member rides under its own STRING key
    // instead. RFC 9052 §1.5.
    const label = Object.hasOwn(spec.labels, field) ? spec.labels[field] : undefined;
    const key = label ?? field;

    const nested = nestedFor(spec, field);
    if (nested) {
      const childSpec = nested.spec();
      map.set(
        key,
        nested.array && Array.isArray(value)
          ? value.map((item) => compactEncode(item as Dict, childSpec))
          : compactEncode(value as Dict, childSpec),
      );
    } else {
      map.set(key, value);
    }
  }

  return map;
};

/**
 * The mirror: an integer key resolves through the table, a string key is its own
 * name.
 *
 * ⛔ TWO KEYS CANNOT RESOLVE TO ONE FIELD, and this refuses it. RFC 9052 §1.5
 * makes the integer `2` and the text `"sub"` different map keys, but they are two
 * renderings of ONE declared member — so a map carrying both states two values for
 * one field and the winner falls to map order. Reachable on a real signed CWT at
 * `aegis.parse` and `aegis.verify`: `act` as
 * `Map { 2 => "audited-service", "sub" => "rogue-service" }` replaces the actor
 * the issuer named. ⚠ Deterministic encoding sorts the map so the text key lands
 * last, but a raw-CBOR forgery can put either one there.
 *
 * ⚠ A `CoseError`, not the translator's `claim_structure_invalid`: one member
 * under BOTH of its COSE renderings is a fact about the COSE encoding with no
 * JOSE counterpart. A look-alike NAME beside the real one — `act` as
 * `Map { 2 => "audited", "subject" => "rogue" }` — still goes to the translator
 * and is refused there identically on both wires.
 */
export const compactDecode = (
  map: Map<number | string, unknown>,
  spec: CompactSpec,
): Dict => {
  const reverse = new Map<number, string>(
    Object.entries(spec.labels).map(([field, label]) => [label, field]),
  );

  // Which field each key resolved to, and the key that got there first — a `Map`,
  // never `Object.hasOwn` on `obj`, because the keys are a PRODUCER's and a field
  // legitimately named `constructor` or `toString` must not read as taken.
  const resolved = new Map<string, number | string>();

  const obj: Dict = {};
  for (const [key, value] of map) {
    // An unnamed INTEGER key is dropped — a label from a registry this deployment
    // does not hold, with no name to report it under. A STRING key is
    // self-describing and rides back.
    const field = isString(key) ? key : reverse.get(key);
    if (field === undefined) continue;

    const taken = resolved.get(field);

    if (taken !== undefined) {
      // Both keys, in a STABLE order (integer label first) whichever arrived
      // first: a refusal a reader cannot reproduce is not a repair instruction.
      const [label, name] = isString(key) ? [taken, key] : [key, taken];

      throw new CoseError("Two COSE map keys resolve to one member", {
        code: "cose_duplicate_member_key",
        data: { claim: spec.claim, member: field, label, key: name },
        title: "Two COSE Map Keys Resolve To One Member",
        details:
          "A structured claim's COSE map carries a member under BOTH its integer label and its interoperable string name. Those are two different map keys but one declared member, so the map states two values for one field and neither can be honoured — picking one would let whoever wrote the token decide by map order. RFC 9052 §1.5.",
      });
    }

    resolved.set(field, key);

    const nested = nestedFor(spec, field);
    const decoded = nested
      ? nested.array && Array.isArray(value)
        ? value.map((item) =>
            item instanceof Map ? compactDecode(item, nested.spec()) : item,
          )
        : value instanceof Map
          ? compactDecode(value, nested.spec())
          : value
      : value;

    // ⛔ `Object.defineProperty`, NEVER `obj[field] = decoded`: `field` is a
    // PRODUCER-supplied text key here, and assigning `__proto__` invokes
    // `Object.prototype`'s setter instead of creating a member, handing the
    // translator a structure whose prototype the token chose.
    Object.defineProperty(obj, field, {
      value: decoded,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }

  return obj;
};
