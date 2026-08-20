import { isDate, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { WIRE_TAGS } from "../internal/registry/wire.js";
import type { TokenFormatTag } from "../types/index.js";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG_CERT, TEST_OCT_KEY_ENC } from "./keys.js";
import type { ScenarioContext } from "./run-scenario.js";
import type { SpecDisposition, SpecDoor, SpecObservation } from "./spec-dispositions.js";
import { CLIENT, ISSUER, RESOURCE, type Wire } from "./scenarios.js";

/**
 * The PER-SPEC interpreter — the code half of the disposition tables, exactly as
 * `run-scenario.ts` is the code half of the scenario table. A table entry names a
 * door; every door is implemented here once.
 */

/**
 * WHY a (spec, wire) cell failed, as a stable tag rather than as prose — the
 * same discipline `run-knob-probe.ts` carries, and for the identical reason.
 *
 * ⚠ A `defect` SKIPS its wires in the matrix, and the self-verifying defect test
 * proves the skip is still earned by RUNNING the cell and requiring it to fail.
 * A coarse "it threw" accepts ANY exception as that proof — including this
 * file's own {@link SPEC_DISPOSITION_FAILURE.harnessBroken} throws, which sit
 * directly above the door call and which any table edit can raise. A dead entry
 * would then keep a wire skipped forever with nothing behind the skip, which is
 * exactly what the tag exists to prevent.
 *
 * Each message begins with its tag; the sentence after it is for whoever has to
 * fix the thing.
 */
export const SPEC_DISPOSITION_FAILURE = {
  /**
   * The ENTRY or this interpreter cannot run the cell at all — a disposition
   * with no door, a door or observation nothing implements. Never a shortfall in
   * aegis, so never proof of one.
   */
  harnessBroken: "HARNESS_BROKEN",
  /**
   * The door, or the artifact an observation names, threw instead of producing
   * something to read. Ambiguous between a real refusal and a sample that has
   * gone stale — the `GIVEN_DOES_NOT_BUILD` of this matrix — so it is not proof
   * either.
   */
  artifactNotBuilt: "ARTIFACT_NOT_BUILT",
  /**
   * The parameter did not come back under its domain name from a `roundTrip`
   * door, or is absent from the artifact a `notSuppliable` entry names. THE
   * shortfall this matrix exists to find.
   */
  parameterLost: "PARAMETER_LOST",
  /** A `refused` door ACCEPTED the parameter instead of refusing it. */
  refusalMissing: "REFUSAL_MISSING",
} as const;

export type SpecDispositionFailure =
  (typeof SPEC_DISPOSITION_FAILURE)[keyof typeof SPEC_DISPOSITION_FAILURE];

/** The tags that mean the shortfall a `defect` declares is still there. */
export const SPEC_DISPOSITION_DEFECT_TAGS: ReadonlyArray<SpecDispositionFailure> = [
  SPEC_DISPOSITION_FAILURE.parameterLost,
  SPEC_DISPOSITION_FAILURE.refusalMissing,
];

/** The claims format each wire mints as. */
const FORMAT: Record<Wire, TokenFormatTag> = { jose: "jwt", cose: "cwt" };

/** The disposition that applies on ONE wire: the per-wire override, else the base. */
export const dispositionOn = (
  disposition: SpecDisposition,
  wire: Wire,
): SpecDisposition => ({ ...disposition, ...disposition.per?.[wire], per: undefined });

/**
 * The wires a spec's disposition is RUN on: every wire, less the ones a declared
 * `defect` names. A defect skips its wires in the matrix and is proved
 * separately — see the self-verifying defect test.
 */
export const specWiresOf = (disposition: SpecDisposition): ReadonlyArray<Wire> =>
  WIRE_TAGS.filter((wire) => !(disposition.defect?.wires ?? []).includes(wire));

/**
 * Equality that admits the two shapes a domain value legitimately changes into
 * on the way back.
 *
 * A `date` claim leaves as a `Date` and returns as a `Date`, but through a
 * NumericDate it loses sub-second precision (RFC 7519 §2 — "the number of
 * seconds from 1970-01-01T00:00:00Z UTC"), so the comparison is on whole
 * seconds. Everything else must come back exactly as it went out — a looser
 * comparison here is how a codec bug passes as a round trip.
 */
const expectSameValue = (actual: unknown, expected: unknown, label: string): void => {
  if (isDate(expected)) {
    expect(actual, label).toBeInstanceOf(Date);
    expect(Math.floor((actual as Date).getTime() / 1000), label).toBe(
      Math.floor(expected.getTime() / 1000),
    );
    return;
  }

  expect(actual, label).toEqual(expected);
};

/**
 * The crit members' own parameters, so a `crit` sample can be put on a header
 * that is well-formed. Each member is a DOMAIN name and takes a placeholder
 * value — `crit` states WHICH parameters are critical, never what they hold.
 */
const critMembersOf = (sample: unknown): Dict =>
  Array.isArray(sample)
    ? Object.fromEntries(sample.map((member: string) => [member, "crit_member_sample"]))
    : {};

/**
 * A KIT result's two header buckets as ONE lookup, for a presence observation.
 *
 * ⚠ Which bucket a parameter rides is a WIRE fact, not a domain one: RFC 9052
 * §3.1 puts the `kid` hint in the unprotected bucket because it "is not a
 * security-critical field", while JOSE compact serialisation has only the
 * protected one (RFC 7515 §7.1). An observation that read the protected bucket
 * alone would report a COSE `kid` as absent — which is a statement about the
 * observation, not about the token.
 *
 * Only the KIT doors need it. The DOMAIN doors report ONE header, already merged
 * under the header registry's `placement` allowlist, which is the same union for
 * every parameter a domain door can produce: the two `"either"` rows are `kid`
 * and `iv`, and everything else is protected on both wires.
 */
const bothBuckets = (protectedHeader: unknown, unprotectedHeader: unknown): Dict => ({
  ...((unprotectedHeader ?? {}) as Dict),
  ...((protectedHeader ?? {}) as Dict),
});

type DoorInput = {
  ctx: ScenarioContext;
  domain: string;
  sample: unknown;
  wire: Wire;
};

/**
 * Open a door with the sample and hand back the DOMAIN-named value the public
 * read surface reports for it. `undefined` is a value the caller compares like
 * any other — it is what a dropped parameter looks like.
 */
const openDoor = async (door: SpecDoor, input: DoorInput): Promise<unknown> => {
  const { ctx, domain, sample, wire } = input;
  const format = FORMAT[wire];

  switch (door) {
    case "mint.content": {
      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h", [domain]: sample } as never,
        { format } as never,
      );
      return (await ctx.aegis.verify(token)).claims[domain as never];
    }

    case "mint.expires": {
      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: sample } as never,
        { format } as never,
      );
      return (await ctx.aegis.verify(token)).claims.expiresAt;
    }

    case "mint.issuer": {
      const { token } = await ctx.aegis.mint(
        "delegation",
        {
          issuer: sample,
          subject: "user-1",
          audience: [RESOURCE],
          expires: "1h",
        } as never,
        { format } as never,
      );

      // ⚠ READ THROUGH `parse`, not `verify`, and only here. `delegation` is the
      // one profile whose issuer is per-token, which is what makes the claim
      // caller-suppliable at all — and a token issued by somebody OTHER than this
      // deployment has no verification key in this deployment's vault, so a
      // verify would fail on key resolution and say nothing about the claim. The
      // keyless read is the only one that can observe a foreign issuer, which is
      // the whole point of a per-token one.
      return ctx.aegis.parse(token).claims.issuer;
    }

    case "mint.sign": {
      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        { format, sign: { [domain]: sample } } as never,
      );
      return (await ctx.aegis.verify(token)).claims[domain as never];
    }

    case "mint.profile": {
      const { token } = await ctx.aegis.mint(
        "userinfo",
        {
          subject: "user-1",
          audience: [CLIENT],
          expires: "1h",
          profile: { [domain]: sample },
        } as never,
        { format } as never,
      );
      return (await ctx.aegis.verify(token)).profile?.[domain as never];
    }

    case "mint.sensitive": {
      // BOTH recipient keys: JOSE seals with the ECDH-ES key and COSE_Encrypt0 is
      // direct encryption (RFC 9052 §5.2), so the COSE run needs the symmetric one.
      ctx.amphora.add(TEST_EC_KEY_ENC);
      ctx.amphora.add(TEST_OCT_KEY_ENC);

      const { token } = await ctx.aegis.mint(
        "userinfo",
        {
          subject: "user-1",
          audience: [CLIENT],
          expires: "1h",
          claims: { [domain]: sample },
        } as never,
        { format } as never,
      );
      return (await ctx.aegis.verify(token)).sensitive?.[domain as never];
    }

    case "mint.header": {
      // ⚠ `crit` names OTHER parameters, and RFC 9052 §3.1 makes a member whose
      // parameter is not in the protected bucket "a fatal error in processing the
      // message" — RFC 7515 §4.1.11 says the same for JOSE. So the one parameter
      // whose value is a list of parameter NAMES has to put those parameters in
      // the header too, or the artifact it builds is malformed by construction
      // and the read fails for a reason that has nothing to do with the round
      // trip under test.
      const named = domain === "critical" ? critMembersOf(sample) : {};

      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        { format, sign: { header: { ...named, [domain]: sample } } } as never,
      );
      return ctx.aegis.parse(token).header[domain as never];
    }

    case "mint.typ": {
      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        { format, sign: { typ: sample } } as never,
      );
      return ctx.aegis.parse(token).header.headerType;
    }

    case "encrypt.party": {
      ctx.amphora.add(TEST_EC_KEY_ENC);

      const { token } = await ctx.aegis.jwe.encrypt({ hello: "world" }, {
        [domain]: sample,
      } as never);

      // `parse` refuses an encrypted token outright — its payload is ciphertext —
      // so the header of a sealed artifact is read through `decrypt`, which is the
      // domain verb that opens one.
      return (await ctx.aegis.decrypt(token)).header[domain as never];
    }

    default: {
      const exhaustive: never = door;
      throw new Error(
        `${SPEC_DISPOSITION_FAILURE.harnessBroken} — unhandled spec door "${String(exhaustive)}"`,
      );
    }
  }
};

/**
 * Produce the artifact a `notSuppliable` observation names and report the bucket
 * its parameter would ride, plus WHICH VOCABULARY that bucket is keyed in.
 *
 * ⚠ The two are not interchangeable. The domain read surface reports a decrypted
 * token's PROTECTED header only, so a COSE_Encrypt0's IV — which RFC 9052 §3.1
 * puts in the UNPROTECTED bucket under label 5 — is invisible there; the kit
 * door reports both buckets but in the WIRE vocabulary. An observation that read
 * the domain bucket alone would report such a parameter as absent, which is a
 * statement about the reader and not about the token.
 */
const observeHeader = async (
  observation: Exclude<SpecObservation, "none">,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<{ bucket: Dict; vocabulary: "domain" | "wire" }> => {
  switch (observation) {
    case "sign":
    case "claims": {
      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        { format: FORMAT[wire] } as never,
      );
      const parsed = ctx.aegis.parse(token);

      return {
        vocabulary: "domain",
        bucket:
          observation === "sign"
            ? (parsed.header as unknown as Dict)
            : (parsed.claims as unknown as Dict),
      };
    }

    case "encrypt":
    case "encrypt.ecdh": {
      // The ECDH-ES observation names its recipient key EXPLICITLY. Left to the
      // resolver, a vault holding both an agreement key and a symmetric one may
      // seal with the symmetric one — and a direct-encryption JWE produces no
      // ephemeral key at all, so the observation would report the parameter
      // absent while proving only which key the resolver happened to pick.
      ctx.amphora.add(TEST_EC_KEY_ENC);
      ctx.amphora.add(TEST_OCT_KEY_ENC);

      const key =
        observation === "encrypt.ecdh"
          ? { condition: { id: TEST_EC_KEY_ENC.id } }
          : undefined;

      const { token } = await ctx.aegis.encrypt({ hello: "world" }, {
        format: wire === "cose" ? "cwe" : "jwe",
        ...(key ? { key } : {}),
      } as never);

      // Read through the KIT door, which reports every bucket its wire has. The
      // domain `decrypt` reports one merged header. JOSE has a single bucket
      // (`src/types/header/wire-buckets.ts#export type JoseHeaderBuckets`), so the pair collapses
      // to it rather than pairing it with an empty second bag.
      const bucket =
        wire === "cose"
          ? await ctx.aegis.cwe
              .decrypt(token)
              .then((o) => bothBuckets(o.protectedHeader, o.unprotectedHeader))
          : await ctx.aegis.jwe.decrypt(token).then((o) => o.header as unknown as Dict);

      return { vocabulary: "wire", bucket };
    }

    case "certificate": {
      ctx.amphora.add(TEST_EC_KEY_SIG_CERT);

      const { token } = await ctx.aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        {
          format: FORMAT[wire],
          sign: {
            key: { condition: { id: TEST_EC_KEY_SIG_CERT.id } },
            bindCertificate: "chain",
          },
        } as never,
      );
      const parsed = ctx.aegis.parse(token);

      return {
        vocabulary: "domain",
        bucket: parsed.header as unknown as Dict,
      };
    }

    default: {
      const exhaustive: never = observation;
      throw new Error(
        `${SPEC_DISPOSITION_FAILURE.harnessBroken} — unhandled observation "${String(exhaustive)}"`,
      );
    }
  }
};

/**
 * Run ONE (spec, wire) cell.
 *
 * ⚠ A `notSuppliable` entry whose observation is `"none"` asserts NOTHING, and
 * that is the one place in this suite where nothing is asserted. It is allowed
 * only because the alternative is worse — an entry that pretends to observe a
 * parameter no fixture can produce — and the table test requires such an entry to
 * carry a reason, so the silence is stated rather than reached.
 */
export const runSpecDisposition = async (input: {
  ctx: ScenarioContext;
  disposition: SpecDisposition;
  domain: string;
  sample: unknown;
  /** The parameter's JOSE WIRE name, for an observation that reads a wire bucket. */
  wireKey: string;
  wire: Wire;
}): Promise<void> => {
  const { ctx, domain, sample, wire } = input;
  const disposition = dispositionOn(input.disposition, wire);

  switch (disposition.disposition) {
    case "roundTrip": {
      const { door } = disposition;

      if (door === undefined) {
        throw new Error(
          `${SPEC_DISPOSITION_FAILURE.harnessBroken} — ${domain} [${wire}] declares a roundTrip with no door, so there is nothing for the matrix to open. Fix the entry.`,
        );
      }

      // ⚠ The door's OWN throw is caught and tagged apart from the value not
      // coming back. A `roundTrip` claims the parameter is SUPPLIABLE and comes
      // back; a door that refuses the sample outright is as likely a sample that
      // has gone stale as it is a shortfall, so it must never be readable as
      // proof that a declared defect still manifests.
      const value = await openDoor(door, { ctx, domain, sample, wire }).catch(
        (error: unknown) => {
          throw new Error(
            `${SPEC_DISPOSITION_FAILURE.artifactNotBuilt} — ${domain} [${wire}] the ${door} door REFUSED the sample instead of round-tripping it, so nothing was read back. Either the sample no longer suits the door, or the door refuses what the entry says it accepts. It failed with: ${(error as Error).message}`,
          );
        },
      );

      expectSameValue(
        value,
        sample,
        `${SPEC_DISPOSITION_FAILURE.parameterLost} — ${domain} [${wire}] did not come back from the ${door} door under its domain name`,
      );
      return;
    }

    case "refused": {
      if (disposition.door === undefined) {
        throw new Error(
          `${SPEC_DISPOSITION_FAILURE.harnessBroken} — ${domain} [${wire}] declares a refusal with no door, so there is nothing for the matrix to open. Fix the entry.`,
        );
      }

      // The refusal must come from the DOOR, so it is caught here and rethrown
      // only when it did not happen. A `resolves` assertion would report "the
      // mint succeeded" without naming what it produced.
      const outcome = await openDoor(disposition.door, {
        ctx,
        domain,
        sample,
        wire,
      }).then(
        (value) => `it was ACCEPTED, and read back as ${JSON.stringify(value)}`,
        () => undefined,
      );

      expect(
        outcome,
        `${SPEC_DISPOSITION_FAILURE.refusalMissing} — ${domain} [${wire}] has no representation on this wire, so the ${disposition.door} door must REFUSE it rather than drop it — ${outcome}`,
      ).toBeUndefined();
      return;
    }

    case "notSuppliable": {
      if (disposition.observe === "none" || disposition.observe === undefined) return;

      const observe = disposition.observe;

      // Same split as the `roundTrip` door: an observation whose ARTIFACT will
      // not build reports nothing about the parameter, so it is tagged apart
      // from the parameter being absent from an artifact that did build.
      const observed = await observeHeader(observe, ctx, wire).catch((error: unknown) => {
        throw new Error(
          `${SPEC_DISPOSITION_FAILURE.artifactNotBuilt} — ${domain} [${wire}] the ${observe} observation could not build its artifact, so nothing it looks for means anything. It failed with: ${(error as Error).message}`,
        );
      });

      const key = observed.vocabulary === "domain" ? domain : input.wireKey;

      expect(
        isUndefined(observed.bucket[key]),
        `${SPEC_DISPOSITION_FAILURE.parameterLost} — ${domain} [${wire}] is produced by the operation the entry names, so it must appear on the artifact that operation builds (looked for "${key}" in the ${observed.vocabulary} vocabulary)`,
      ).toBe(false);
      return;
    }

    default: {
      const exhaustive: never = disposition.disposition;
      throw new Error(
        `${SPEC_DISPOSITION_FAILURE.harnessBroken} — unhandled disposition "${String(exhaustive)}"`,
      );
    }
  }
};

/** The label a matrix row carries — the spec, its disposition and its wire. */
export const specLabel = (
  domain: string,
  disposition: SpecDisposition,
  wire: Wire,
): string => `${domain} — ${dispositionOn(disposition, wire).disposition} [${wire}]`;

export { ISSUER };
