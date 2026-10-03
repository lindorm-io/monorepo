import { isNumber, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import {
  type ClaimSpec,
  claimByCose,
  claimByCoseName,
  coseName,
} from "../claims/claims-registry.js";
import { isNotStated } from "../claims/is-not-stated.js";
import { isNumericDate } from "../claims/is-numeric-date.js";
import { codecFor } from "../registry/param-spec.js";
import { CWT_CLAIMS_KIT } from "./cwt-spec.js";

export type EncodeCwtOptions = {
  /**
   * Use compact private-use integer COSE labels. Default `false`: a claim with a
   * private-use label (`< -65536`) is emitted under its JOSE string key and the
   * structured claims are string-keyed, so an interoperable reader can read the
   * token. `true` keys them by their compact integer label instead.
   *
   * ⚠ The flag chooses digit-vs-string only; no claim is ever omitted.
   */
  proprietary?: boolean;
};

/**
 * Encode ALREADY-WIRE (COSE-name-keyed) claims into a CWT claims map (RFC 8392):
 * integer labels where the registry has one, the wire string name where it does
 * not, custom claims under their literal key.
 *
 * ⚠ The codec ONLY. `domainToWire` does the domain -> wire translation (name and
 * value shape) before this runs, so there is no domain remap here.
 */
export const encodeCwtClaims = (
  wire: Dict,
  options: EncodeCwtOptions = {},
): Map<number | string, unknown> => {
  const map = CWT_CLAIMS_KIT.encode("map", wire, {
    proprietary: options.proprietary ?? false,
  });

  // The codec spec does not know unregistered custom claims, so they are merged in
  // under their literal wire key.
  for (const [key, value] of Object.entries(wire)) {
    if (value === undefined) continue;
    if (claimByCoseName(key)) continue;
    map.set(key, value);
  }

  return map;
};

/**
 * The registered claim a CWT map key names, in every form a producer can write it:
 * the integer label, a private-use claim's text alias, a label-less claim's text
 * name, and the text twin of labels 1–9.
 */
const registeredClaimAt = (key: unknown): ClaimSpec | undefined => {
  if (isNumber(key)) return claimByCose(key);
  if (isString(key)) return claimByCoseName(key);

  return undefined;
};

const refuseNumericDate = (spec: ClaimSpec, key: number | string): never => {
  throw new CoseError("Malformed CWT claim", {
    code: "cose_malformed",
    data: { claim: coseName(spec), label: key },
    title: "Malformed CWT",
    details: `aegis reads the ${coseName(spec)} claim as a NumericDate, a number of seconds since the epoch that a date can hold, written without a tag; this token carries something else, so the instant cannot be read. RFC 8392 §2.`,
  });
};

/**
 * Decode a CWT claims map into the COSE-name-keyed WIRE shape; unknown labels are
 * kept verbatim under their wire key. The codec ONLY — `wireToDomain` maps the
 * result to the domain shape.
 *
 * A registered claim stated as the CBOR null or undefined is dropped, and a
 * NumericDate claim holding anything but a number is refused, BEFORE the codec:
 * the codec reshapes a value (`String(wire)`, `new Date(wire * 1000)`,
 * `Buffer.from`) before `wireToDomain` could see it was not stated.
 */
export const decodeCwtClaims = (map: Map<unknown, unknown> | Dict): Dict => {
  // ⚠ `preferMap: false` keeps the top CWT map a `Map` only while it has integer
  // keys, so a CWT whose claims are ALL custom decodes as a plain object.
  // Normalised back to a Map here — top level only; nested claim objects stay
  // plain — so the codec always sees a Map.
  const asMap: Map<number | string, unknown> =
    map instanceof Map
      ? (map as Map<number | string, unknown>)
      : new Map(Object.entries(map));

  // ⚠ The decoded claims object is prototype-safe, and NOT because of anything
  // here: `@lindorm/cbor` writes every `lax`-mode member with
  // `Object.defineProperty`, so a foreign CWT's `__proto__` claim key lands as an
  // ordinary OWN key. That matters because registered claims are read off this bag
  // BY PROPERTY — an inherited `aud` would answer as though the issuer stated it,
  // on a token whose signature verifies.
  //
  // ⛔ Rebuilding the object here is a NO-OP, so it would be a guard whose removal
  // cannot turn a test red. The consequence is pinned in
  // `internal/claims/claims-proto-forgery.test.ts`.
  //
  // ⚠ A `Map` rebuilt key by key, never `omitNotStated`: its `Object.entries`
  // turns the label `1` into the text `"1"`, which resolves to no claim and lands
  // in `custom`.
  const stated = new Map<number | string, unknown>();

  for (const [key, value] of asMap) {
    const spec = registeredClaimAt(key);

    if (spec !== undefined) {
      if (isNotStated(value)) continue;

      if (codecFor(spec, "cose").kind === "date" && !isNumericDate(value)) {
        refuseNumericDate(spec, key);
      }
    }

    stated.set(key, value);
  }

  return CWT_CLAIMS_KIT.decode("map", stated);
};
