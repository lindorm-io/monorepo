import { isArray, isMap, isObject } from "@lindorm/is";
import type { InvalidEntry } from "../../types/index.js";

/**
 * ⛔⛔ `__proto__` IS NOT A MEMBER NAME A REGISTERED CLAIM MAY CARRY, AT ANY DEPTH
 * — the ONE place that rule is decided, for every registered claim and both
 * directions.
 *
 * ⚠⚠ "REGISTERED" IS THE WHOLE SCOPE, AND IT IS NARROWER THAN "EVERY CLAIM" — a
 * sentence here said the latter and it is measurably false. Only a
 * `claimByDomain` / registry hit is routed through {@link encodeClaim} /
 * {@link decodeClaim}; an UNREGISTERED custom claim takes the else branch
 * (`wire[snakeCase(key)] = value` on write, `custom[camelCase(key)] = value` on
 * read) and is never scanned. Measured, both directions:
 *   `Aegis.toWire(JSON.parse('{"my_custom":{"__proto__":{"pwn":"yes"}}}'))`
 *     -> returned, `Object.hasOwn(out.my_custom, "__proto__") === true`, no refusal
 *   `aegis.parse(<forged>)` -> `custom.myCustom` with the same live own key
 *
 * ⭐ THAT IS A DELIBERATE LINE, NOT AN OVERSIGHT, AND IT IS DRAWN WHERE THE HAZARD
 * IS CREATED. A registered claim's value is REBUILT by this package —
 * `wireToDomain` finishes with `omitUndefined(claims)` — so aegis is what turns the
 * own property into a prototype swap, and refusing is the only disposal that holds.
 * `custom` is never rebuilt (`omitUndefined` runs on `claims` alone, measured: the
 * own key survives and nothing is polluted), so aegis is a pass-through pipe there.
 * Refusing inside it would mean rejecting a whole token — its registered claims
 * included — over a member name inside an extension claim this package explicitly
 * declines to interpret, which contradicts the registry's own stance on `custom`
 * (carried, key-flipped, value untouched). ⚠ A consumer that rebuilds that bag
 * re-creates the swap, and the README says so rather than leaving it implied.
 *
 * ⚠ A TOP-LEVEL CLAIM KEY LITERALLY NAMED `__proto__` IS NOT THE HAZARD. Both
 * `camelCase` and `snakeCase` return `"proto"` for it, so it lands in `custom` as
 * an ordinary key (measured: `{"__proto__":{…}}` -> `custom.proto`). The hazard is
 * the name appearing INSIDE a claim's value.
 *
 * ⚠⚠ THE HAZARD IS NOT A STRUCTURE'S, IT IS THE CLAIM BAG'S, and that is why
 * this is not a rule inside the structure walker. `__proto__` is a legal JSON
 * member name and `JSON.parse` makes it an ordinary own data property, so a token
 * can carry one; what turns it into a prototype swap is a REBUILD. The read side
 * performs exactly that rebuild on every claim it resolves —
 * `internal/claims/translate.ts`'s `wireToDomain` finishes with
 * `omitUndefined(claims)`, and `@lindorm/utils`'s `omitFromObject` recurses with
 * `result[key] = cleaned` (`packages/utils/src/internal/omit-from-object.ts:26`),
 * which re-invokes the setter. A consumer's natural read then returns
 * attacker-supplied data that `Object.keys` and `JSON.stringify` both render as
 * absent, and no duplicate-key defence can see it because no own key survives to
 * be claimed twice.
 *
 * ⚠⚠ MEASURED ON THIS TREE, through `aegis.parse` on HAND-FORGED tokens — the
 * unauthenticated door, because reading a payload needs no key. It was NOT one
 * claim's hole and it was not a structured claim's hole:
 *   - `events` (a `bespoke` passthrough): keys `["urn:e"]`, stringify
 *     `{"urn:e":{}}`, `claims.events.pollutedParse` -> `"yes"`. On BOTH wires, and
 *     again one level deeper inside an event payload.
 *   - `sub_id` and `authorization_details` — ALREADY on the declared member set —
 *     through their `open: "verbatim"` tails, whose nested values the walker
 *     carries but never descends: `{"format":"opaque","tail":{}}` with
 *     `subjectId.tail.pwn` -> `"yes"`.
 *   - `cnf.jwk`, carried verbatim by the confirmation decoder.
 *   - `email_verified` — a `bool` claim, no structure anywhere near it: `{}` with
 *     `.pwn` -> `"yes"`.
 * ⇒ The disposal cannot be keyed on a codec, a member set or an `open` column,
 * because the rebuild does not ask about any of them. It is asked ONCE, of the
 * whole claim value, at the claim boundary.
 *
 * ⚠ THE WRITE SIDE IS SCANNED TOO, and not for symmetry's sake. `Aegis.toWire`
 * hands the caller a dict in which `__proto__` is still a live own data property
 * (measured: `{"urn:e":{"__proto__":{"pwn":"yes"}}}`), and the first thing that
 * rebuilds it re-creates the swap. A mint does not reach the wire with one — the
 * same `omitFromObject` eats it during normalisation — so refusing on write costs
 * a conformant caller nothing and closes the vocabulary door.
 *
 * ⚠ THE ROOT CAUSE IN `@lindorm/utils` IS NOT FIXED HERE. It is a shared
 * low-level utility with its own blast radius, and it is reported rather than
 * changed from inside this package.
 *
 * ⚠ IT RETURNS VIOLATIONS RATHER THAN THROWING. The claim boundary owns the
 * refusal, so this list joins whatever else is wrong with the same claim instead
 * of pre-empting it — the stance `internal/profiles/enforce-policy.ts` takes for a
 * whole token.
 */

/** The one member name no claim may carry. */
const PROTO = "__proto__";

const violation = (path: string): InvalidEntry => ({
  key: `${path}.${PROTO}`,
  message: `Member "${PROTO}" is not a member name any structure may use, in "${path}"`,
});

/**
 * Every `__proto__` reachable from a claim value, each located by the path of the
 * container that carries it.
 *
 * ⚠ THREE CONTAINER KINDS, AND THE `Map` ARM IS REACHED FROM THE WRITE SIDE — by
 * a CALLER'S OWN VALUE, not by anything the COSE READ path produces. RFC 9052 §1.5
 * defines a COSE map key as `label = int / tstr`, so a `Map` is the natural way to
 * hand this package a claim with non-string keys, and nothing on the write side
 * converts it before the claim boundary asks. Measured, at the claim root and at
 * depth:
 *   `Aegis.toWire({ events: new Map([["__proto__", { pwn: "yes" }]]) })`
 *     -> refused at `events.__proto__`
 *   `Aegis.toWire({ events: { "urn:e": new Map([["__proto__", …]]) } })`
 *     -> refused at `events.urn:e.__proto__`
 *
 * ⛔ THE READ SIDE DOES NOT REACH IT, AND A NOTE HERE CLAIMED IT DID. It said an
 * interoperable COSE actor stays a `Map` because "no compaction step converts" it.
 * That is wrong at `internal/cose/cwt-spec.ts`: `decompactValue` runs
 * `compactDecode` on ANY `Map`, with no `proprietary` test, so a decoded actor is
 * already a plain object when this scan sees it. The measurement offered for the
 * claim was worse than the claim — instrumenting the arm over the whole suite
 * showed three hits, and all three came from this module's OWN unit test.
 * Re-measured over every COSE-heavy suite in the package (`Cose.interop`,
 * `act-claim-wire`, `sub-id-claim-wire`, `events-claim-wire`,
 * `cose-claims-encoding`, `cwt-claims`, `cwt-spec`, `compact-map`,
 * `cose-private-use-header` — 138 tests) with that file excluded: ZERO.
 *
 * ⭐ IT IS STILL LOAD-BEARING, on the door above rather than the one first named.
 * `cbor2` also decodes a text `__proto__` label preserving it as an OWN key
 * (measured: `hasOwn: true` under both `preferMap: true` and the default), so were
 * a `Map` ever to survive the read path the arm is what would see it — but that is
 * the reason it is CHEAP to keep, not the reason it exists.
 *
 * ⚠ CYCLE PROTECTION TRACKS THE IN-PROGRESS ANCESTORS, NOT EVERY CONTAINER SEEN.
 * A memo would silently skip a container reached twice by two different paths and
 * report a shared hostile sub-object under whichever path happened to be walked
 * first; an ancestor set stops only a walk that would not terminate. It is
 * required rather than defensive: `Aegis.toWire` takes a caller's own object
 * graph, which today reaches the wire without any recursive walk at all, so an
 * unguarded scan would turn a self-referential claim from a passthrough into a
 * hang.
 */
export const protoMemberViolations = (
  value: unknown,
  path: string,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];
  const ancestors = new Set<object>();

  const scan = (container: unknown, here: string): void => {
    if (isArray(container)) {
      if (ancestors.has(container)) return;

      ancestors.add(container);
      container.forEach((element, index) => scan(element, `${here}[${index}]`));
      ancestors.delete(container);

      return;
    }

    // The entries of a `Map` and of a plain object are read the same way once
    // they are in hand; only the way to reach them differs, so the two arms
    // converge on one loop rather than stating the rule twice.
    const entries = isMap(container)
      ? [...container.entries()]
      : isObject(container)
        ? Object.entries(container)
        : undefined;

    if (entries === undefined) return;
    if (ancestors.has(container as object)) return;

    ancestors.add(container as object);

    for (const [key, inner] of entries) {
      // A COSE label may be an integer, so the key is not a string by
      // construction — and an integer label can never BE `__proto__`, which is
      // why the comparison is against the string rather than a coercion of it.
      if (key === PROTO) {
        invalid.push(violation(here));
        continue;
      }

      scan(inner, `${here}.${String(key)}`);
    }

    ancestors.delete(container as object);
  };

  scan(value, path);

  return invalid;
};
