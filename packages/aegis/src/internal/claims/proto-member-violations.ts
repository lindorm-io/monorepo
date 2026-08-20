import { isArray, isMap, isObject } from "@lindorm/is";
import type { InvalidEntry } from "../../types/index.js";

/**
 * ⛔⛔ `__proto__` IS NOT A MEMBER NAME A REGISTERED CLAIM MAY CARRY, AT ANY DEPTH
 * — the ONE place that rule is decided, for every registered claim and both
 * directions.
 *
 * ⛔⛔ THE RULE IS FILED FOR REMOVAL. Read this before relying on it or extending
 * it. Nothing measured below justifies refusing a whole token over this name, and
 * no replacement justification is offered here — inventing one is how a rule
 * outlives its reason.
 *
 * ⭐ WHERE THE HAZARD ACTUALLY LIVED, and how it is closed — by MECHANISM, not by
 * this refusal. `__proto__` is a legal JSON/CBOR member name that `JSON.parse`
 * and the CBOR decoder both make an ordinary OWN property; what turns one into a
 * prototype swap is a REBUILD that writes it with `obj[key] = value`. Two such
 * rebuilds a claim value crosses now write with `Object.defineProperty` /
 * `Object.fromEntries`:
 *   - WRITE `internal/claims/prune-empty-claims.ts` — a swapped claims bag whose
 *     inherited members the COSE codec read BY PROPERTY, so a SIGNED CWT could
 *     carry an `aud` its issuer never stated.
 *   - READ  `internal/claims/translate.ts` — the custom bag, TWICE: once as it is
 *     built (the FLOOR mode keys unconverted, so the name arrives verbatim) and
 *     again in `wireToFloorClaims`, which rebuilds it to drop shadowing names.
 * The COSE claims DECODE is not one of them: aegis rebuilds nothing there, and
 * the disposal lives entirely in `@lindorm/cbor`
 * (`internal/utils/decode-cbor-map.ts` — see `internal/cose/cwt-claims.ts`).
 * `@lindorm/utils`'s `omitFromObject` was never one either: it writes with
 * `Object.defineProperty` (`omit-from-object.ts:32`, whose own line 26 reads
 * *"⚠ NOT `result[key] = cleaned`"*), so it PRESERVES the key.
 *
 * ⚠⚠ MEASURED WITH THIS SCAN DISABLED, on PROPERTY reads — `JSON.stringify` and
 * `Object.keys` render a swapped prototype as ABSENT, so a measurement taken with
 * either reports a forged bag as clean:
 *   `aegis.parse` (forged token, `events["urn:e"].__proto__`)
 *     -> parses; own keys `["__proto__"]`; prototype UNCHANGED; `.pwn` undefined
 *   `JwtKit.sign` / `CwtKit.sign` (the WIRE doors)
 *     -> mint; `.pwn` undefined; nothing in the process polluted
 * ⇒ With the refusal gone, the member is carried as an ordinary own key and
 * forges nothing.
 *
 * ⛔⛔ AND IT BREAKS THE INVARIANT IT WAS MEANT TO SERVE: AEGIS MINTS A TOKEN ITS
 * OWN READERS REFUSE. It runs where CLAIM TRANSLATION runs — the DOMAIN doors —
 * and the WIRE doors take an already-wire dict verbatim and never reach it.
 * Measured through the public doors, one shape (`cnf.jwk.__proto__`):
 *   `aegis.sign(...)`      -> REFUSED `claim_structure_invalid`
 *   `new JwtKit(...).sign` -> MINTED
 *   `aegis.parse(<that token>)`  -> REFUSED `claim_structure_invalid`
 *   `aegis.verify(<that token>)` -> REFUSED `claim_structure_invalid`
 * ⇒ A public wire door emits a token this package's own keyless reader rejects —
 * the exact failure "a token aegis mints is a token aegis verifies" names, caused
 * by the refusal rather than prevented by it.
 *
 * ⚠ A TOP-LEVEL claim key named `__proto__` is refused by nothing at all: only the
 * DOMAIN vocabulary doors case-convert it to `proto` (measured:
 * `Aegis.toDomain` -> `custom.proto`, `Aegis.toWire` -> `proto`), and a wire door
 * does no conversion.
 *
 * ⇒ WHAT IS LEFT IS A POLICY ABOUT A NAME, applied at some doors and not others,
 * with the mechanism it was written for closed elsewhere. Whether aegis wants
 * that policy — at the cost of refusing a token every other JOSE/COSE
 * implementation accepts — is an owner's call, not this file's.
 *
 * ⚠ SCOPE, if it stays: "REGISTERED" is narrower than "every claim". Only a
 * `claimByDomain` / registry hit is routed through {@link encodeClaim} /
 * {@link decodeClaim}; an UNREGISTERED custom claim takes the else branch and is
 * never scanned. `custom` is a pass-through pipe — and so, now, is a registered
 * claim, which is why the asymmetry between them no longer rests on anything.
 *
 * ⚠ IF IT STAYS, IT MUST BE ASKED ONCE, of the whole claim value, at the claim
 * boundary: no codec, member set or `open` column predicts where the name
 * appears, so the disposal cannot be keyed on any of them.
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
