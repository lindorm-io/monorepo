import { isArray, isObject, isString, isUndefined } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { CLAIM_SPECS, coseName, joseName } from "../internal/claims/claims-registry.js";
import { WIRE_TAGS, type Wire } from "../internal/registry/wire.js";
import type {
  CoseSignStructuredTokenOptions,
  JoseSignStructuredTokenOptions,
  VerifyOptions,
} from "../types/index.js";
import { inspectToken, type TokenInspection, type WirePart } from "./inspect-token.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_ENC_CERT,
  TEST_EC_KEY_SIG,
  TEST_EC_KEY_SIG_CERT,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_ENC_CBC,
  TEST_OCT_KEY_ENC_GCM128,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "./keys.js";
import type {
  ArtifactGivenStep,
  DateCell,
  FormatTag,
  Given,
  KeyFixture,
  KnobProbe,
  ObservationStep,
  Verdict,
  WireAssertion,
} from "./knob-probes.js";
import type { WireKey } from "./raw-bucket.js";
import type { TestDeployment } from "./test-deployment.js";
import { signAsThirdParty } from "./third-party-producer.js";

/**
 * The knob-probe INTERPRETER — all the code, so a probe stays a literal.
 *
 * It drives aegis twice per probe: the baseline, with the knob absent, and the
 * flipped run, with the knob set to the probe's value.
 *
 * ⚠ THE ASSERTION IS THE DIFFERENCE, never the flipped run alone. A knob that is
 * accepted and dropped produces two IDENTICAL runs, which is the only signal
 * available: nothing throws, nothing is missing from the wire, and the caller's
 * request has simply evaporated. So every probe checks BOTH runs and requires
 * them to disagree.
 */

/** Where a table's knob is written into the call — `[]` is the bag itself. */
export type KnobPath = ReadonlyArray<string>;

/** The bags a probe table writes into, and the path each one sits at. */
export const KNOB_PATHS = {
  verify: [],
  mint: [],
  mintSign: ["sign"],
  mintEncrypt: ["encrypt"],
  mintContext: ["context"],
  encrypt: [],
} as const satisfies Record<string, KnobPath>;

const KEY_FIXTURES: Record<KeyFixture, IKryptos> = {
  "ec-enc": TEST_EC_KEY_ENC,
  "ec-enc-cert": TEST_EC_KEY_ENC_CERT,
  "ec-sig-cert": TEST_EC_KEY_SIG_CERT,
  "oct-enc": TEST_OCT_KEY_ENC,
  "oct-enc-cbc": TEST_OCT_KEY_ENC_CBC,
  "oct-enc-gcm128": TEST_OCT_KEY_ENC_GCM128,
  "oct-sig": TEST_OCT_KEY_SIG,
  "okp-sig": TEST_OKP_KEY_SIG,
};

/** The format a wire-agnostic mint resolves to, and the one a domain encrypt does. */
const MINT_FORMAT = { jose: "jwt", cose: "cwt" } as const satisfies Record<Wire, string>;
const ENCRYPT_FORMAT = { jose: "jwe", cose: "cwe" } as const satisfies Record<
  Wire,
  string
>;

/**
 * The JOSE→COSE claim-name divergences, DERIVED from the claim registry. A claim
 * left under its JOSE name on the COSE wire raises nothing — it becomes an
 * unregistered custom claim — so a hand-kept list would go on passing while
 * probing a look-alike.
 */
const COSE_CLAIM_SPELLING: ReadonlyMap<string, string> = new Map(
  CLAIM_SPECS.filter((spec) => coseName(spec) !== joseName(spec)).map((spec) => [
    joseName(spec),
    coseName(spec),
  ]),
);

const respellForCose = (claims: Dict): Dict =>
  Object.fromEntries(
    Object.entries(claims).map(([key, value]) => [
      COSE_CLAIM_SPELLING.get(key) ?? key,
      value,
    ]),
  );

/** A probe's custom bag re-spelled for COSE: the one JOSE header is COSE's protected bucket. */
const coseCustomOf = (
  custom: JoseSignStructuredTokenOptions["custom"],
): CoseSignStructuredTokenOptions["custom"] =>
  isUndefined(custom) ? undefined : { protected: custom.header };

/**
 * A {@link DateCell} is the ONE value shape a table cannot spell as JSON, so it is
 * the one the interpreter revives — a lone `date` member holding a string.
 *
 * The shape is narrow on purpose. A recursive revive is what a probe needs (a
 * temporal claim sits inside the GIVEN's content, not only in the knob's own
 * value), and a looser test would start rewriting any claim that merely happens to
 * carry a `date`.
 */
const isDateCell = (value: unknown): value is DateCell =>
  isObject(value) && Object.keys(value).length === 1 && isString((value as Dict).date);

/**
 * Deep-clone a probe's data, reviving every {@link DateCell} on the way.
 *
 * The CLONE is what keeps the two runs independent: both are built from the
 * same module-level literal, so writing the knob into the flipped one would
 * otherwise mutate the baseline's — and the table is shared by every wire in the
 * matrix, so the leak would cross rows as well.
 */
const materialise = <T>(value: T): T =>
  isArray(value)
    ? (value.map(materialise) as unknown as T)
    : isDateCell(value)
      ? (new Date(value.date) as unknown as T)
      : isObject(value)
        ? (Object.fromEntries(
            Object.entries(value as Dict).map(([key, entry]) => [
              key,
              materialise(entry),
            ]),
          ) as T)
        : value;

/** The artifact step is the LAST GIVEN step — the tuple type says so; this says it once at runtime. */
const artifactOf = (given: Given): ArtifactGivenStep => {
  const last = given[given.length - 1];

  if (last.step === "token") return last;

  throw new Error(`the last GIVEN step must build the artifact, received "${last.step}"`);
};

/** The option bag a write probe's knob is written into, created when the probe states none. */
const artifactOptionsOf = (given: Given): Dict => {
  const artifact = artifactOf(given);

  if (artifact.via === "foreign") {
    throw new Error(
      "a write probe's GIVEN must build the token through aegis, not a third party",
    );
  }

  const withOptions = artifact as { options?: Dict };

  withOptions.options = withOptions.options ?? {};

  return withOptions.options;
};

/** Write `value` at `path` inside `bag`, creating the intermediate bags. */
const setAtPath = (bag: Dict, path: KnobPath, key: string, value: unknown): void => {
  let target = bag;

  for (const segment of path) {
    target[segment] = target[segment] ?? {};
    target = target[segment] as Dict;
  }

  target[key] = value;
};

/**
 * The probe body that applies to THIS wire — the override where the row states
 * one, otherwise the probe's own.
 *
 * An override REPLACES the value and the outcome rather than merging with them:
 * a knob whose default differs between the wires needs a different value AND a
 * different expectation, and a partial override would leave one of the two
 * describing the other wire.
 */
const bodyFor = <T>(probe: KnobProbe<T>, wire: Wire): KnobProbe<T> => {
  const override = probe.overrides?.[wire];

  if (override === undefined) return probe;

  return { ...probe, ...override } as KnobProbe<T>;
};

/** The wires a probe RUNS on: every wire, less the ones it declares it cannot state. */
export const probeWiresOf = <T>(probe: KnobProbe<T>): ReadonlyArray<Wire> =>
  WIRE_TAGS.filter(
    (wire) =>
      probe.unobservable?.[wire] === undefined &&
      !(probe.defect !== undefined && (probe.defect.wires ?? WIRE_TAGS).includes(wire)),
  );

/**
 * WHY a probe failed, as a stable tag rather than as prose.
 *
 * ⚠ Only two of these mean THE OPTION IS DROPPED. The other three mean the PROBE
 * is broken — its GIVEN no longer builds, its observation was already true
 * without the knob, or the act reached a different verdict than the probe states
 * it reaches WITHOUT the knob — and all of them fail in exactly the same
 * direction as a real shortfall does. That matters because a declared `defect`
 * SKIPS its wire in the matrix, and the self-verifying defect test proves the
 * skip is still earned by running the probe and requiring it to fail. A coarse
 * "it failed" would accept a rotted probe as proof and leave the skip standing
 * forever with nothing behind it, so the tag is what the check reads.
 *
 * Each message begins with its tag, and the tag is the whole contract; the
 * sentence after it is for whoever has to fix the thing.
 */
export const KNOB_PROBE_FAILURE = {
  /** The probe's own baseline artifact will not build. The GIVEN is broken. */
  givenDoesNotBuild: "GIVEN_DOES_NOT_BUILD",
  /** The observation held WITHOUT the knob, so it demonstrates nothing. */
  observationVacuous: "OBSERVATION_VACUOUS",
  /**
   * The act WITHOUT the knob reached a verdict the probe does not state. The
   * probe's PREMISE is broken — the verdict half of `GIVEN_DOES_NOT_BUILD`, and
   * never evidence about the knob.
   */
  baselineDisagrees: "BASELINE_DISAGREES",
  /** The observation did not hold WITH the knob set — the option is dropped. */
  optionDropped: "OPTION_DROPPED",
  /**
   * The act WITH the knob set reached the SAME verdict as without it — the
   * option is dropped.
   *
   * ⚠ The emitter never compares the two runs to each other; it compares each
   * against its own declaration, and raises THIS tag for the FLIPPED run alone —
   * a baseline mismatch is a statement about the probe and raises
   * `BASELINE_DISAGREES` instead. That is what makes the name true: the flipped
   * check is reached only after the baseline matched its declaration, and the
   * table requires a probe's two declared verdicts to DIFFER, so a flipped run
   * that misses its own declaration has reached the baseline's verdict.
   */
  verdictAgrees: "VERDICT_AGREES",
} as const;

export type KnobProbeFailure =
  (typeof KNOB_PROBE_FAILURE)[keyof typeof KNOB_PROBE_FAILURE];

/** The tags that mean the shortfall a `defect` declares is still there. */
export const KNOB_PROBE_DEFECT_TAGS: ReadonlyArray<KnobProbeFailure> = [
  KNOB_PROBE_FAILURE.optionDropped,
  KNOB_PROBE_FAILURE.verdictAgrees,
];

/** What a run leaves behind: the token, and the kind aegis reported it as. A third party reports none. */
type Artifact = { token: string; format?: string; wrapper?: string };

/** The act under test: the construction itself, or a plain domain verify over it. */
type Act = { step: "mint" } | { step: "verify"; options?: VerifyOptions };

/** Stock the vault, then build the artifact on the run's wire. */
const build = async (
  given: Given,
  ctx: TestDeployment,
  wire: Wire,
): Promise<Artifact> => {
  for (const step of given) {
    if (step.step !== "keys") continue;

    for (const fixture of step.keys) {
      ctx.amphora.add(KEY_FIXTURES[fixture]);
    }
  }

  const artifact = artifactOf(given);

  switch (artifact.via) {
    case "kit-sign": {
      const signed =
        wire === "cose"
          ? await ctx.aegis.cwt.sign(respellForCose(artifact.claims), {
              ...artifact.options,
              custom: coseCustomOf(artifact.options?.custom),
            })
          : await ctx.aegis.jwt.sign(artifact.claims, artifact.options);

      return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
    }

    case "foreign":
      return {
        token: await signAsThirdParty(wire, artifact.claims, undefined, TEST_EC_KEY_SIG),
      };

    case "mint": {
      // `mint<P>` resolves the content type from the profile NAME, and here the
      // artifact is the whole union of members, which TypeScript cannot correlate
      // with a per-member content — the probe itself is checked against its own.
      const signed = await ctx.aegis.mint(artifact.profile, artifact.content as never, {
        format: MINT_FORMAT[wire],
        ...artifact.options,
      });

      return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
    }

    case "domain-encrypt": {
      const encrypted = await ctx.aegis.encrypt(artifact.data, {
        format: ENCRYPT_FORMAT[wire],
        ...artifact.options,
      });

      return { token: encrypted.token, format: encrypted.format };
    }

    default: {
      const exhaustive: never = artifact;
      throw new Error(`unhandled artifact ${JSON.stringify(exhaustive)}`);
    }
  }
};

/** Build the artifact and perform the act on it; whatever throws is the rejection. */
const perform = async (
  given: Given,
  act: Act,
  ctx: TestDeployment,
  wire: Wire,
): Promise<Artifact> => {
  const built = await build(given, ctx, wire);

  if (act.step === "mint") return built;

  const verified = await ctx.aegis.verify(built.token, undefined, act.options);

  return { token: verified.token, format: verified.format, wrapper: verified.wrapper };
};

/** The raw part an observation names, as the inspector reports it. */
const PART_OF = {
  wireProtectedHeader: "protectedHeader",
  wireClaims: "payload",
} as const satisfies Record<ObservationStep["step"], "protectedHeader" | "payload">;

type WireBucket = { has: (key: WireKey) => boolean; record: Dict };

const readable = <T>(payload: WirePart<T>): T => {
  if (payload.readable) return payload.value;

  throw new Error(`the probe observes the raw wire claims, but ${payload.reason}`);
};

/**
 * One raw bucket in the form the assertions consume. `has` takes the wire's OWN
 * key — a lookup that stringified it would merge the integer label `4` with the
 * text label `"4"` (RFC 9052 §1.5). The RECORD is stringified because that is
 * what an object literal in a probe already is, and it serves value comparison
 * alone. An unreadable payload THROWS rather than reading as empty: every
 * inclusion and exclusion passes over an empty container.
 */
const bucketOf = (
  inspection: TokenInspection,
  part: "protectedHeader" | "payload",
): WireBucket => {
  if (inspection.wire === "jose") {
    const source =
      part === "payload" ? readable(inspection.payload) : inspection.protectedHeader;

    return { has: (key) => Object.hasOwn(source, String(key)), record: source };
  }

  const source =
    part === "payload" ? readable(inspection.payload) : inspection.protectedHeader;

  return {
    has: (key) => source.has(key),
    record: Object.fromEntries(
      [...source].map(([label, value]) => [String(label), value]),
    ),
  };
};

/** Apply one probe's `includes`/`present`/`excludes` to a raw bucket. */
const assertWireBucket = (assertion: WireAssertion, bucket: WireBucket): void => {
  if (assertion.includes) {
    expect(bucket.record).toMatchObject(assertion.includes);
  }
  for (const key of assertion.present ?? []) {
    expect(bucket.has(key), `expected the raw wire bucket to carry ${String(key)}`).toBe(
      true,
    );
  }
  for (const key of assertion.excludes ?? []) {
    expect(
      bucket.has(key),
      `expected the raw wire bucket NOT to carry ${String(key)}`,
    ).toBe(false);
  }
};

/** A format tag on the artifact, bare or per wire; absent means the probe says nothing about it. */
const assertTag = (
  stated: FormatTag | undefined,
  actual: string | undefined,
  wire: Wire,
  field: "format" | "wrapper",
): void => {
  if (isUndefined(stated)) return;

  const expected = isString(stated) ? stated : stated[wire];

  expect(
    expected,
    `the probe states a per-wire ${field} but names none for the ${wire} wire`,
  ).toBeDefined();
  expect(actual, `the artifact's ${field}`).toBe(expected);
};

/** What an artifact probe observes about the artifact it built. */
type Observations = {
  format?: FormatTag;
  wrapper?: FormatTag;
  observed: ReadonlyArray<ObservationStep>;
};

const NOTHING: Observations = { observed: [] };

/** Every observation stated for this wire, in the order written; the rest are another wire's spelling. */
const observe = (artifact: Artifact, observations: Observations, wire: Wire): void => {
  assertTag(observations.wrapper, artifact.wrapper, wire, "wrapper");
  assertTag(observations.format, artifact.format, wire, "format");

  for (const step of observations.observed) {
    if (step.on !== undefined && step.on !== wire) continue;

    assertWireBucket(step, bucketOf(inspectToken(artifact.token), PART_OF[step.step]));
  }
};

/**
 * Run once and report only WHETHER the act was accepted.
 *
 * Everything else is deliberately left out: a verdict probe's whole content is
 * which of the two answers came back, and an observation folded in here would
 * make a red probe ambiguous between "the knob was dropped" and "something else
 * about the token changed".
 */
const verdictOf = (
  given: Given,
  act: Act,
  ctx: TestDeployment,
  wire: Wire,
): Promise<Verdict> =>
  perform(given, act, ctx, wire).then(
    () => "accepts" as const,
    () => "rejects" as const,
  );

/**
 * Did this run's OBSERVATIONS hold, and if not, WHY?
 *
 * The reason is carried rather than discarded: a probe that fails because its own
 * setup is broken and one that fails because the knob was dropped are the same
 * boolean, and telling them apart from the harness's diagnosis alone has been the
 * slowest part of writing every row here.
 */
const observationHeld = async (
  given: Given,
  act: Act,
  observations: Observations,
  ctx: TestDeployment,
  wire: Wire,
): Promise<{ held: boolean; because?: string }> => {
  try {
    observe(await perform(given, act, ctx, wire), observations, wire);
    return { held: true };
  } catch (error) {
    return { held: false, because: (error as Error).message };
  }
};

/**
 * Run one probe on one wire.
 *
 * A verify probe's knob rides the VERIFY call, so its GIVEN is built untouched
 * and the act carries the options; a write probe's knob rides the CONSTRUCTION,
 * which is then the act.
 *
 * A VERDICT probe is two runs: the two must reach the stated (and differing)
 * verdicts.
 *
 * An ARTIFACT probe is THREE, and the first is what makes it honest: the baseline
 * artifact must BUILD (otherwise a probe would "pass" because its own setup was
 * broken), its observations must then FAIL, and only the flipped artifact's may
 * hold. Two runs would let a probe whose observation holds unconditionally sit
 * green forever.
 */
export const runKnobProbe = async <T>({
  bag,
  key,
  probe,
  ctx,
  wire,
}: {
  bag: keyof typeof KNOB_PATHS;
  key: string;
  probe: KnobProbe<T>;
  ctx: () => Promise<TestDeployment>;
  wire: Wire;
}): Promise<void> => {
  const body = bodyFor(probe, wire);
  const path = KNOB_PATHS[bag];
  const value = materialise(body.value);

  const baselineGiven = materialise(probe.given);
  const flippedGiven = materialise(probe.given);

  const baselineAct: Act = bag === "verify" ? { step: "verify" } : { step: "mint" };
  const flippedAct: Act =
    bag === "verify"
      ? { step: "verify", options: { [key]: value } as VerifyOptions }
      : { step: "mint" };

  if (bag !== "verify") {
    setAtPath(artifactOptionsOf(flippedGiven), path, key, value);
  }

  if (body.baseline !== undefined) {
    const baseline = await verdictOf(baselineGiven, baselineAct, await ctx(), wire);
    const flipped = await verdictOf(flippedGiven, flippedAct, await ctx(), wire);

    // ⚠ BASELINE FIRST, and it throws — which is what lets the flipped check
    // below mean "the two runs agree" rather than merely "one of them missed its
    // declaration".
    expectBaselineVerdict(key, wire, baseline, body.baseline);
    expectFlippedVerdict(key, wire, flipped, body.flipped as Verdict);
    return;
  }

  const observations: Observations = {
    format: body.format,
    wrapper: body.wrapper,
    observed: body.observed ?? [],
  };

  const builds = await observationHeld(
    materialise(probe.given),
    baselineAct,
    NOTHING,
    await ctx(),
    wire,
  );

  if (!builds.held) {
    throw new Error(
      `${KNOB_PROBE_FAILURE.givenDoesNotBuild} — ${key} [${wire}] the probe's own baseline artifact does not build, so nothing it observes means anything. Fix the GIVEN. It failed with: ${builds.because}`,
    );
  }

  const baseline = await observationHeld(
    baselineGiven,
    baselineAct,
    observations,
    await ctx(),
    wire,
  );

  if (baseline.held) {
    throw new Error(
      `${KNOB_PROBE_FAILURE.observationVacuous} — ${key} [${wire}] the observation HOLDS without the knob, so it demonstrates nothing about the knob. Either the artifact already has what is being observed, or the observation is vacuous.`,
    );
  }

  const flipped = await observationHeld(
    flippedGiven,
    flippedAct,
    observations,
    await ctx(),
    wire,
  );

  if (!flipped.held) {
    throw new Error(
      `${KNOB_PROBE_FAILURE.optionDropped} — ${key} [${wire}] the observation does NOT hold with the knob set. The option is accepted and dropped, or the observation names the wrong thing. It failed with: ${flipped.because}`,
    );
  }
};

const expectVerdict = (
  tag: KnobProbeFailure,
  detail: string,
  key: string,
  wire: Wire,
  when: string,
  actual: Verdict,
  expected: Verdict,
): void => {
  if (actual === expected) return;

  throw new Error(
    `${tag} — ${key} [${wire}] ${when} the act ${actual}, but the probe states it ${expected}. ${detail}`,
  );
};

/**
 * The run WITHOUT the knob must reach the verdict the probe states it reaches.
 *
 * ⚠ Its own tag, deliberately OUTSIDE {@link KNOB_PROBE_DEFECT_TAGS}. A baseline
 * that disagrees is the verdict form of `GIVEN_DOES_NOT_BUILD`: the probe's
 * premise has rotted — its artifact no longer builds what it built, or the
 * default it was written against has moved — and that is a statement about the
 * probe, never about the knob. Sharing `VERDICT_AGREES` with the flipped run
 * would let the self-verifying defect test accept a dead verdict probe as proof
 * the declared shortfall still manifests, so a wire could stay skipped forever
 * with nothing behind the skip. The artifact form guards its own setup twice
 * (`builds`, then `baseline`); this is the verdict form's single guard.
 */
const expectBaselineVerdict = (
  key: string,
  wire: Wire,
  actual: Verdict,
  expected: Verdict,
): void =>
  expectVerdict(
    KNOB_PROBE_FAILURE.baselineDisagrees,
    "That is the PROBE's premise, not the knob's effect: fix the GIVEN, or the baseline verdict the probe declares.",
    key,
    wire,
    "without the knob",
    actual,
    expected,
  );

/** The run WITH the knob set must reach the OTHER verdict. */
const expectFlippedVerdict = (
  key: string,
  wire: Wire,
  actual: Verdict,
  expected: Verdict,
): void =>
  expectVerdict(
    KNOB_PROBE_FAILURE.verdictAgrees,
    "A knob that is accepted and dropped makes both runs agree; that is what this catches.",
    key,
    wire,
    `with ${key} set`,
    actual,
    expected,
  );
