import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";

/**
 * A spec for compacting a fixed-member object to an integer-keyed CBOR map and
 * back. `labels` maps each known field to its integer label; `nested` declares
 * fields that are themselves compacted (recursively), optionally as an array.
 *
 * Used for the proprietary (smaller) COSE encoding of the structured claims with
 * a fixed member set — `act`/`mayAct` (RFC 8693) and `sub_id` (RFC 9493).
 * An unknown member rides under its own STRING key rather than being dropped —
 * see {@link compactEncode} for why that changed. The compact form is opt-out via
 * `proprietary: false`.
 *
 * ⭐ NO SPEC IS HAND-WRITTEN ANY MORE. Every one is DERIVED from the claim
 * registry's declared member set (`compact-spec-from-members.ts`) — `sub_id` was
 * the last hand-written table and it went with the member declaration. So a label
 * is written down in exactly one place, and the byte layer cannot disagree with
 * the registry about what an integer means.
 */
export type CompactSpec = {
  /**
   * The CLAIM this spec describes, carried so a refusal can name it. Its only
   * reader is the duplicate-key refusal in {@link compactDecode} — a decode is
   * several layers below the translator and has no other way to say WHICH claim
   * a malformed map belongs to.
   */
  claim: string;
  labels: Readonly<Record<string, number>>;
  nested?: Readonly<Record<string, { array?: boolean; spec: () => CompactSpec }>>;
};

/**
 * ⚠⚠ IT WALKS THE VALUE, NOT THE LABEL TABLE, AND THAT IS A FIX RATHER THAN A
 * STYLE CHOICE. Walking `spec.labels` visits only the members the spec names, so
 * a member the value carries and the table does not was DROPPED — silently, from
 * a signed token, and only in `proprietary` mode, while the interoperable
 * encoding of the same claim kept it. One domain call, two encodings, two
 * different statements. That went from latent to live the moment the RFC 8693
 * actor claim opened its member set: an issuer writing the `email` member §4.4
 * names would have had it on an interoperable CWT and not on an on-platform one.
 *
 * An unlabelled member therefore rides under its own STRING key. RFC 9052 §1.5
 * permits it outright — "In COSE, we use text strings, negative integers, and
 * unsigned integers as map keys", with the grammar `label = int / tstr` — so a
 * mixed-label map is a legal COSE map, and a stock reader sees the tail under the
 * name its own specification gave it.
 */
/**
 * The nested spec for one field — resolved with `Object.hasOwn`, NEVER through
 * the prototype chain.
 *
 * ⛔⛔ THIS IS AN UNAUTHENTICATED CRASH IF IT IS GOT WRONG, and it was. `field`
 * used to be a DECLARED name on both sides (encode walked `spec.labels`, decode
 * resolved integers through a reverse table), and the value-walk made it
 * caller-and-producer-controlled — at which point `spec.nested?.[field]` resolved
 * `toString`, `constructor` and `valueOf` to `Object.prototype`'s own members and
 * `nested.spec()` threw a bare `TypeError`. Measured:
 *   - `mint("default", { act: { subject: "s", toString: "x" } }, { format: "cwt", proprietary: true })`
 *     -> `TypeError: nested.spec is not a function`.
 *   - `aegis.parse(<CWT whose compact actor map carries the text key "toString">)`
 *     -> the same, from an UNAUTHENTICATED door: `parse` reads the payload before
 *     any signature is checked, so a hostile token crashes the reader.
 * An open member set is what makes a prototype name a legal member in the first
 * place, so this is not a theoretical key. (Control: `email` round-trips clean.)
 *
 * ⚠ The sibling lookup on `spec.labels` already guards this way, in the very next
 * statement, and its comment states the hazard. Two lookups, one rule.
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
 * ⛔⛔ TWO KEYS CANNOT RESOLVE TO ONE FIELD, AND THIS REFUSES IT. RFC 9052 §1.5
 * makes the integer `2` and the text string `"sub"` DIFFERENT COSE labels
 * ("In COSE, we use text strings, negative integers, and unsigned integers as map
 * keys", grammar `label = int / tstr`) — but they are two renderings of ONE
 * declared member, so a map carrying both says two things about one field and the
 * winner was decided by map order, silently.
 *
 * ⚠⚠ IT WAS LIVE, IT REACHED A SIGNED WIRE, AND IT WAS NEW IN THIS BATCH. Before
 * the value-walk, decode was `reverse.get(label)` — a text key resolved to
 * `undefined` and was DROPPED, so no merge was possible. Carrying text keys fixed
 * a real data-loss bug (an unlabelled member vanished from a proprietary token
 * while the interoperable encoding of the same claim kept it) and opened this.
 * Measured on a REAL signed CWT, at `aegis.parse` AND at `aegis.verify`:
 *   - `act` as `Map { 2 => "audited-service", "sub" => "rogue-service" }` read
 *     back as `{ subject: "rogue-service" }` — the actor the issuer named,
 *     replaced, with no refusal on either door.
 *   - `sub_id` as `Map { 0 => "phone_number", 5 => "+46700000000",
 *     "phone_number" => "+00000000000" }` read back with the forged number.
 * ⚠ BOTH KEY ORDERS GAVE THE SAME WINNER on a real token, and that is worth
 * stating: CBOR deterministic encoding sorts the map, so the author's insertion
 * order is normalised away and the text key always lands last. A raw-CBOR forgery
 * that skips the canonical ordering CAN put either one last.
 *
 * ⭐ WHY A `CoseError` HERE AND NOT THE TRANSLATOR'S `claim_structure_invalid`.
 * The fault is that ONE member arrived under BOTH of ITS COSE RENDERINGS — its
 * integer label and its interop string fallback — which is a fact about the COSE
 * ENCODING of a member and has no JOSE counterpart at all, JOSE having one
 * rendering per member. The fault that DOES exist on both wires — a look-alike
 * NAME beside the real one — is refused by the translator on both, identically:
 * measured, `act` as `Map { 2 => "audited", "subject" => "rogue" }` is refused
 * `claim_structure_invalid` exactly as the JOSE `{ sub, subject }` is, because
 * label 2 resolves to the field `sub` and `subject` stays a separate key for
 * `walkObject` to collide. So the one-rule-both-wires property is intact, and
 * this refusal is the wire's own.
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
    // An INTEGER key the table does not name is the one thing still dropped: it
    // is a label from a registry this deployment does not hold, and there is no
    // name to report it under. A STRING key is self-describing and rides back.
    const field = isString(key) ? key : reverse.get(key);
    if (field === undefined) continue;

    const taken = resolved.get(field);

    if (taken !== undefined) {
      // Both keys are named, and in a STABLE order — the integer label first,
      // whichever arrived first — because a refusal a reader cannot reproduce is
      // a repair instruction nobody can follow.
      const [label, name] = isString(key) ? [taken, key] : [key, taken];

      throw new CoseError("Two COSE map keys resolve to one member", {
        code: "cose_duplicate_member_key",
        data: { claim: spec.claim, member: field, label, key: name },
        title: "Two COSE Map Keys Resolve To One Member",
        details:
          "A structured claim's COSE map carries a member under BOTH its integer label and its interoperable string name. RFC 9052 §1.5 makes those different map keys, but they are two renderings of one declared member, so the map states two values for one field and neither can be honoured — picking one would let whoever wrote the token decide by map order.",
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

    // ⛔ `Object.defineProperty`, NEVER `obj[field] = decoded`. `field` is a
    // PRODUCER-supplied text key on this side, and assigning `__proto__` invokes
    // `Object.prototype`'s setter instead of creating a member — so a token could
    // hand the translator a structure whose prototype it chose. The translator
    // one level up takes the same precaution for the same reason.
    Object.defineProperty(obj, field, {
      value: decoded,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }

  return obj;
};
