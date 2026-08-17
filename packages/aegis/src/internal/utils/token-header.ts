import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { JoseError } from "../../errors/index.js";
import { normaliseHeaders } from "../header/normalise-headers.js";
import type {
  CertificateHeaderFields,
  WireTokenHeader,
  DomainTokenHeader,
  WireTokenHeaderOptions,
  DomainTokenHeaderOptions,
} from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { canonicalWireHeader } from "../header/canonical-wire-header.js";
import { criticalToWire } from "../header/critical-to-wire.js";
import {
  type HeaderCodec,
  type HeaderSpec,
  headerByDomain,
  headerByJose,
  coseWireKey,
  headerJoseName,
} from "../header/header-registry.js";
import { getBaseFormat } from "./compute-typ-header.js";

/**
 * The header translator (the header-side twin of `claims/translate.ts`): the ONE
 * place a header parameter's name is translated, in ANY direction, on EITHER
 * wire, driven entirely by `HEADER_SPECS`. Every pass is DATA-DRIVEN — it
 * iterates the actual header data, not a curated subset, and looks each key up in
 * the registry:
 *
 *   - {@link mapTokenHeader}       write, `domain -> jose`  (via `headerByDomain`)
 *   - {@link shapeWireHeader}      write, `jose -> jose`   (via `headerByJose`)
 *   - {@link parseTokenHeader}     read,  `jose -> domain`  (via `headerByJose`)
 *   - {@link wireHeaderToCoseMap}  write, `jose -> cose label` (via `coseWireKey`)
 *
 * Unlike custom claims, headers are a CLOSED set: a key with no registry entry is
 * dropped (no passthrough), in both directions, by the passes below. The
 * registry's `HeaderCodec` drives the value shaping.
 *
 * ⚠ The COSE pass is value-PASSTHROUGH for every parameter but ONE: the
 * caller-settable COSE params (`typ`/`cty`/`x5c`/`x5u`) already carry the wire
 * representation that round-trips back on read, so shaping them here would only
 * change the bytes. `crit` is the exception, and has to be — see
 * {@link critToCoseLabels}.
 */

// --- `crit` member remap (the one member-transforming parameter) ------------

// The domain -> wire direction lives in `header/critical-to-wire.ts`: it is the
// ONE vocabulary anything comparing crit members against header keys has to
// share, and applying it here is what entitles `assert-crit-satisfied.ts` to
// compare a bucket's `crit` members against its keys without mapping either.

/** Remap `crit` members WIRE -> DOMAIN; unregistered members pass through. */
const criticalToDomain = (members: unknown): Array<string> => {
  if (!Array.isArray(members)) return [];
  return members.map((member): string => headerByJose(member)?.domain ?? member).sort();
};

// --- value shaping (registry `HeaderCodec` dispatch) ------------------------

/**
 * Shape a header value for the WIRE: apply the kind's defensive guard and return
 * `undefined` for a missing or wrongly-typed value (dropped by both write passes).
 * Buffer fields (iv/p2s/tag) pass through as Buffers; `encodeJoseHeader`
 * base64url-encodes them.
 *
 * It takes the VALUE, not the source bag, because the two write passes read the
 * value under different keys — `mapTokenHeader` under the domain name,
 * {@link shapeWireHeader} under the JOSE one — while the guard they apply must be
 * the same one, from the same registry row.
 */
const encodeHeaderValue = (spec: HeaderSpec, value: unknown): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "critical":
      return criticalToWire(value);
    case "string":
      return isString(value) ? value : undefined;
    case "url":
      return isUrlLike(value) ? value : undefined;
    case "number":
      return isFinite(value) ? value : undefined;
    case "jwk":
      return isObject(value) ? value : undefined;
    case "buffer":
      return value;
    case "array":
      return Array.isArray(value) ? value : undefined;
    default: {
      // The `never` binding is on `codec` — that is what makes the compiler bite
      // on a new HeaderCodec member. The REPORTED fact must be the `kind` STRING:
      // stringifying the codec OBJECT yields "[object Object]" and loses the one
      // fact this handler exists to name.
      const exhaustive: never = codec;
      throw new JoseError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: {
          jose: headerJoseName(spec),
          domain: spec.domain,
          kind: String((exhaustive as HeaderCodec).kind),
        },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the encoder does not handle; a HeaderSpec codec kind is missing an encode branch.",
      });
    }
  }
};

/**
 * Shape a header value for the DOMAIN header: the parser copies the wire value
 * verbatim, except `crit`, whose members are remapped wire -> domain.
 */
const decodeHeaderValue = (spec: HeaderSpec, decoded: Dict): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "critical":
      return criticalToDomain(decoded.crit);
    case "string":
    case "url":
    case "number":
    case "jwk":
    case "buffer":
    case "array":
      return decoded[headerJoseName(spec)];
    default: {
      // See `encodeHeaderValue`: the `never` binding is the compiler backstop,
      // but the REPORTED fact must be the string discriminant — `String(codec)`
      // on the codec object reads "[object Object]".
      const exhaustive: never = codec;
      throw new JoseError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: {
          jose: headerJoseName(spec),
          domain: spec.domain,
          kind: String((exhaustive as HeaderCodec).kind),
        },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the parser does not handle; a HeaderSpec codec kind is missing a decode branch.",
      });
    }
  }
};

/**
 * Map domain header options (+ the kit-resolved cert fields) to the raw JOSE wire
 * header. The cert fields (`certificateChain`/`certificateThumbprint`/
 * `certificateThumbprintSha1`) are derived by the kit from the kryptos rather
 * than supplied by a caller, so they are folded into the domain-keyed source (their
 * `CertificateHeaderFields` keys already equal their domain names).
 *
 * The output is canonically ordered ({@link canonicalWireHeader}) and
 * NORMALISED ({@link normaliseHeaders}) — this pass is the domain tier's whole
 * crossing, so what it returns is a finished bag.
 *
 * ⚠ The normalisation is LOAD-BEARING HERE, not merely a repeat of the emission
 * boundary's, and it is what makes the DOMAIN spelling agree with the wire one: a
 * `contentType: ""` is resolved to an absent `cty` before the kit door below it
 * reads the bag. It replaced a bare `omitUndefined`, whose top-level effect here
 * was nil — the loop above never writes an `undefined`.
 *
 * ⚠ IT IS NOT THE ONLY EARLY CROSSING, and must not be described as one. A caller
 * reaching a kit door directly (`aegis.jws.sign`, `aegis.cwe.encrypt`, …) never
 * passes through here, and those doors read the caller's `cty` before the header
 * is assembled (`serialiseContent(data, callerHeader.cty)`) — so each of them
 * normalises the caller's bag at the door, for the same reason and with the same
 * call. This pass answers the DOMAIN tier alone.
 *
 * ⚠ It knows nothing about `crit`, and needs to know nothing: a parameter the
 * message's `crit` names can never be empty here, because the builder that owns
 * the message refuses that header outright (`assert-crit-satisfied.ts`). This
 * pass is a FRAGMENT of a message — the domain tier, or the cert tier alone — and
 * a fragment cannot answer a question about the whole.
 */
export const mapTokenHeader = (
  options: DomainTokenHeaderOptions,
  cert: CertificateHeaderFields = {},
): WireTokenHeaderOptions => {
  const source: Dict = {
    ...options,
    certificateChain: cert.certificateChain,
    certificateThumbprint: cert.certificateThumbprint,
    certificateThumbprintSha1: cert.certificateThumbprintSha1,
  };

  // Single pass over the domain-keyed source; an unregistered key is dropped
  // (headers are a closed set), and so is a value the registry's guard rejects.
  const raw: Dict = {};
  for (const key of Object.keys(source)) {
    const spec = headerByDomain(key);
    if (!spec) continue;

    const encoded = encodeHeaderValue(spec, source[key]);
    if (encoded !== undefined) raw[headerJoseName(spec)] = encoded;
  }

  return normaliseHeaders(canonicalWireHeader(raw)) as WireTokenHeaderOptions;
};

/**
 * The WIRE-KEYED write pass: a JOSE-named bag in, the same bag SHAPED out. It
 * translates nothing — the names are already the wire's — it applies the registry
 * row each parameter carries: the closed-set drop for an unregistered key, and the
 * `HeaderCodec` guard for a value of the wrong shape.
 *
 * This is what lets the JOSE kits stay in wire vocabulary end to end. They used to
 * translate the caller's already-wire bag BACK to domain names (`domain -> wire ->
 * domain -> wire`) purely to reach these guards, which put a second crossing point
 * next to the one `domain-header-to-wire.ts` claims to be.
 *
 * ⚠ Key order is NOT canonicalised here: a shaped bag is a MERGE INPUT
 * ({@link buildJoseHeader}), and only the finished header is sorted. EMPTY VALUES
 * are removed here, though — {@link normaliseHeaders} runs on the shaped bag, so
 * every tier the merge unions is already normalised and the merge cannot
 * reintroduce one.
 *
 * ⚠ A MERGE INPUT IS A FRAGMENT OF A MESSAGE, NOT A MESSAGE, and the prune does
 * not care: whether a `crit` in some OTHER tier still names a value this one
 * emits nothing for is a question about the whole message, answered once by
 * {@link buildJoseHeader} on the merged header (`assert-crit-satisfied.ts`) and
 * answered as a REFUSAL. A tier normalisation that had to know the message's crit
 * members is a fragment reasoning about a whole, which is how the answer came out
 * different in four places.
 *
 * `crit` is shaped by the same {@link criticalToWire} the domain pass uses, which
 * is sort-only on this side: a wire-named member misses `headerByDomain` (every
 * domain name that differs from its wire name is camelCase, and the two that do
 * not differ — `jwk`, `zip` — map to themselves), so no member is rewritten.
 */
export const shapeWireHeader = (
  bag: Partial<WireTokenHeaderOptions> | undefined,
): WireTokenHeaderOptions => {
  const raw: Dict = {};

  if (!bag) return raw as WireTokenHeaderOptions;

  for (const key of Object.keys(bag)) {
    const spec = headerByJose(key);
    if (!spec) continue;

    const encoded = encodeHeaderValue(spec, (bag as Dict)[key]);
    if (encoded !== undefined) raw[headerJoseName(spec)] = encoded;
  }

  return normaliseHeaders(raw) as WireTokenHeaderOptions;
};

/**
 * The READ pass: a decoded wire header -> the domain header. An unregistered wire
 * key is dropped (the closed-set rule), and `crit`'s members are remapped wire ->
 * domain.
 *
 * ⚠ IT DOES NOT NORMALISE, and the `omitUndefined` below is NOT the twin of the
 * write passes' {@link normaliseHeaders} — do not "restore the symmetry". Three
 * reasons, any one sufficient:
 *
 *   1. `crit` prunes on the write side, and a read-side prune would delete the
 *      `critical = []` default written two lines below it — a declared invariant,
 *      since `DomainTokenHeader.critical` is non-optional.
 *   2. A read reports what a PRODUCER wrote. A foreign token's `cty: ""` reported
 *      as absent is aegis misreporting someone else's header, and a caller
 *      inspecting `contentType` could not tell the two apart.
 *   3. The read side's own guards are louder and better: `validate-crit.ts`
 *      refuses an empty `crit`, `JweKit.decrypt` refuses any `zip`,
 *      `verify-cert-binding.ts` refuses a thumbprint mismatch. A prune would
 *      delete the evidence each of them fires on.
 *
 * The `omitUndefined` does a DIFFERENT job: `baseFormat` is `undefined` for a
 * token whose `typ` names no recognised format, and the strip is what makes the
 * key ABSENT rather than present-with-`undefined`.
 */
export const parseTokenHeader = <T extends DomainTokenHeader = DomainTokenHeader>(
  decoded: WireTokenHeader,
): T => {
  // Single pass over the decoded wire claims; an unregistered wire key is dropped.
  const result: Dict = {};
  for (const key of Object.keys(decoded)) {
    const spec = headerByJose(key);
    if (!spec) continue;

    result[spec.domain] = decodeHeaderValue(spec, decoded as Dict);
  }

  // `critical` is always present in the domain header (an absent `crit` maps to
  // `[]`), so default it after the pass — the loop only sets it when `crit` is on
  // the wire. This preserves the pre-refactor `criticalToDomain(undefined) -> []`.
  if (result.critical === undefined) result.critical = [];

  // `baseFormat` is DERIVED from `typ` (not a wire parameter of its own), so it
  // is set outside the registry pass. Kits may override it after parsing.
  result.baseFormat = getBaseFormat(decoded.typ);

  return omitUndefined(result) as T;
};

/**
 * Translate `crit`'s members from JOSE wire NAMES to the COSE LABELS the
 * parameters are actually keyed under.
 *
 * RFC 9052 §1.5 defines `label = int / tstr`, so the tstr `"oid"` and the int
 * `-70000` the lindorm `oid` parameter rides under are DIFFERENT labels. RFC 9052
 * §3.1: *"if the crit value list includes a label for which the header parameter
 * is not in the protected-header-parameters bucket, this is a fatal error in
 * processing the message."* Emitting the NAME while keying the parameter by its
 * LABEL therefore produced a token that was fatally malformed by its own
 * `crit` — which is exactly what this pass did until 2026-08-11.
 *
 * ⚠ That is also why the members take {@link coseWireKey} and the SAME
 * `proprietary` mode the parameters do, rather than the integer label: under the
 * interoperable default `oid` sits at the tstr `"oid"`, so a crit naming the
 * integer `-70000` would recreate the very fatal error above — one spelling in
 * the bucket, another in the list that says the bucket must contain it.
 *
 * A member is refused the same way its parameter is: a parameter COSE cannot
 * carry cannot be marked critical on the COSE wire, because there is no label to
 * name it by.
 */
const critToCoseLabels = (value: unknown, proprietary: boolean | undefined): unknown => {
  if (!Array.isArray(value)) return value;

  return value.map((member) =>
    isString(member) ? coseWireKey(member, proprietary) : member,
  );
};

/**
 * The COSE write pass: a caller's WIRE-named partial header bag -> a COSE label
 * map, each wire name resolved through the registry by {@link coseWireKey} (which
 * THROWS for a parameter COSE does not carry).
 *
 * The bag is NORMALISED on entry ({@link normaliseHeaders}), which is what
 * disposes of a value that emits nothing: an `undefined`, and the empty value of
 * a parameter the registry says prunes. That is the whole of the "skip" this pass
 * used to spell as an inline `undefined` check.
 *
 * ⚠ `proprietary` is the INTEROP MODE, and it decides the KEY, never the
 * parameter set: with the default (falsy) a private-use parameter is written
 * under its string label so a foreign reader can interpret it, with `true` under
 * its compact private-use integer. Nothing is added or dropped either way — see
 * `header-registry.ts#coseWireKey`.
 *
 * ⚠ A bag reaching this pass is a BUCKET of a COSE message, not the message, and
 * the prune does not care: whether the protected bucket's `crit` still names a
 * value this bucket emits nothing for is a question about the whole message,
 * answered once by `buildCoseHeaders` (`assert-crit-satisfied.ts`) and answered
 * as a REFUSAL.
 *
 * The inverse of `coseWireHeader`'s read direction, and — per the file docstring
 * — value-PASSTHROUGH except for `crit`, whose MEMBERS are labels in their own
 * right and are translated by {@link critToCoseLabels}.
 */
export const wireHeaderToCoseMap = (
  bag: Partial<WireTokenHeader> | undefined,
  proprietary: boolean | undefined,
): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>();

  if (!bag) return map;

  for (const [jose, value] of Object.entries(normaliseHeaders(bag as Dict))) {
    // ⚠ An UNREGISTERED wire key is NOT dropped here, unlike the two JOSE passes:
    // `coseWireKey` refuses it with `header_no_cose_label`. A caller naming a
    // parameter COSE cannot carry must hear so, not watch it vanish — this is the
    // one place the closed-set rule refuses instead of drops. That is also why
    // there is no registry lookup first: a registered parameter and an
    // unregistered one take the SAME call.
    map.set(
      coseWireKey(jose, proprietary),
      jose === "crit" ? critToCoseLabels(value, proprietary) : value,
    );
  }

  return map;
};
