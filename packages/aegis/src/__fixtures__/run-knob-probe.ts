import { isArray, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { WIRE_TAGS } from "../internal/registry/wire.js";
import type { KnobProbe, Verdict } from "./knob-probes.js";
import { runScenario, type ScenarioContext } from "./run-scenario.js";
import type {
  ArtifactGivenStep,
  DateCell,
  Given,
  Scenario,
  Then,
  When,
  Wire,
} from "./scenarios.js";

/**
 * The knob-probe INTERPRETER — all the code, so a probe stays a literal.
 *
 * It builds two SCENARIOS out of one probe and hands both to `runScenario`: the
 * baseline, with the knob absent, and the flipped one, with the knob set to the
 * probe's value. Reusing the scenario interpreter rather than reimplementing the
 * acts is deliberate — a probe would otherwise have its own idea of what "verify"
 * means, and the two would drift.
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
 * The CLONE is what keeps the two runs independent: both scenarios are built from
 * the same module-level literal, so writing the knob into the flipped one would
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

/**
 * The artifact step is the LAST GIVEN step — the same rule `runScenario` states,
 * restated here because this is the step the knob is written into.
 */
const artifactOptionsOf = (given: Given): Dict => {
  const artifact = given[given.length - 1] as ArtifactGivenStep;

  if (artifact.step === "claims") {
    throw new Error("a write probe's GIVEN must build a token, not a claim dict");
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

const VERDICT_ACCEPTS: Then = [{ step: "accepts" }];

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
   * ⚠ It says "the two runs agree" and it now means it. The emitter never
   * compares the two runs to each other; it compares each against its own
   * declaration, and it used to raise THIS tag for either mismatch — including
   * the baseline's, which is a statement about the probe. It is raised for the
   * FLIPPED run alone now, and that is enough to make the name true: the flipped
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

/**
 * Run one scenario and report only WHETHER it was accepted.
 *
 * Everything the row could assert is deliberately left out: a verdict probe's
 * whole content is which of the two answers came back, and an observation folded
 * in here would make a red probe ambiguous between "the knob was dropped" and
 * "something else about the token changed".
 */
const verdictOf = async (
  scenario: Scenario,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<Verdict> =>
  runScenario(scenario, ctx, wire).then(
    () => "accepts" as const,
    () => "rejects" as const,
  );

/**
 * Did this scenario's OBSERVATIONS hold, and if not, WHY?
 *
 * The reason is carried rather than discarded: a probe that fails because its own
 * setup is broken and one that fails because the knob was dropped are the same
 * boolean, and telling them apart from the harness's diagnosis alone has been the
 * slowest part of writing every row here.
 */
const observationHeld = async (
  scenario: Scenario,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<{ held: boolean; because?: string }> =>
  runScenario(scenario, ctx, wire).then(
    () => ({ held: true }),
    (err: unknown) => ({ held: false, because: (err as Error).message }),
  );

const scenarioFor = (id: string, given: Given, when: When, then: Then): Scenario => ({
  id,
  title: id,
  rationale: "knob probe",
  given,
  when,
  then,
});

/**
 * The acts a probe's artifact goes through. A verify probe's knob rides the
 * VERIFY call, so its given is built untouched and the act carries the options; a
 * write probe's knob rides the CONSTRUCTION, which `runScenario` treats as the
 * first act when `mint` leads.
 */
const whenFor = <T>(
  bag: keyof typeof KNOB_PATHS,
  probe: KnobProbe<T>,
  options: Dict | undefined,
): When =>
  bag === "verify"
    ? [{ step: "verify", options }]
    : probe.act === undefined
      ? [{ step: "mint" }]
      : [{ step: "mint" }, probe.act];

/**
 * Run one probe on one wire.
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
  ctx: () => Promise<ScenarioContext>;
  wire: Wire;
}): Promise<void> => {
  const body = bodyFor(probe, wire);
  const path = KNOB_PATHS[bag];
  const value = materialise(body.value);

  const baselineGiven = materialise(probe.given);
  const flippedGiven = materialise(probe.given);

  const verifyOptions = bag === "verify" ? ({ [key]: value } as Dict) : undefined;

  if (bag !== "verify") {
    setAtPath(artifactOptionsOf(flippedGiven), path, key, value);
  }

  const baselineWhen = whenFor(bag, probe, undefined);
  const flippedWhen = whenFor(bag, probe, verifyOptions);

  if (body.baseline !== undefined) {
    const baseline = await verdictOf(
      scenarioFor(`${key} [baseline]`, baselineGiven, baselineWhen, VERDICT_ACCEPTS),
      await ctx(),
      wire,
    );
    const flipped = await verdictOf(
      scenarioFor(`${key} [flipped]`, flippedGiven, flippedWhen, VERDICT_ACCEPTS),
      await ctx(),
      wire,
    );

    // ⚠ BASELINE FIRST, and it throws — which is what lets the flipped check
    // below mean "the two runs agree" rather than merely "one of them missed its
    // declaration".
    expectBaselineVerdict(key, wire, baseline, body.baseline);
    expectFlippedVerdict(key, wire, flipped, body.flipped as Verdict);
    return;
  }

  const observed: Then = [
    { step: "accepts", ...(body.format === undefined ? {} : { format: body.format }) },
    ...(body.observed ?? []),
  ];

  const builds = await observationHeld(
    scenarioFor(
      `${key} [baseline builds]`,
      materialise(probe.given),
      baselineWhen,
      VERDICT_ACCEPTS,
    ),
    await ctx(),
    wire,
  );

  if (!builds.held) {
    throw new Error(
      `${KNOB_PROBE_FAILURE.givenDoesNotBuild} — ${key} [${wire}] the probe's own baseline artifact does not build, so nothing it observes means anything. Fix the GIVEN. It failed with: ${builds.because}`,
    );
  }

  const baseline = await observationHeld(
    scenarioFor(`${key} [baseline]`, baselineGiven, baselineWhen, observed),
    await ctx(),
    wire,
  );

  if (baseline.held) {
    throw new Error(
      `${KNOB_PROBE_FAILURE.observationVacuous} — ${key} [${wire}] the observation HOLDS without the knob, so it demonstrates nothing about the knob. Either the artifact already has what is being observed, or the observation is vacuous.`,
    );
  }

  const flipped = await observationHeld(
    scenarioFor(`${key} [flipped]`, flippedGiven, flippedWhen, observed),
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
 * probe, never about the knob. It shared `VERDICT_AGREES` with the flipped run,
 * which the self-verifying defect test accepts as proof the declared shortfall
 * still manifests, so a dead verdict probe could keep its wire skipped forever
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
