import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import {
  ENCRYPT_KNOB_PROBES,
  MINT_CONTEXT_KNOB_PROBES,
  MINT_ENCRYPT_KNOB_PROBES,
  MINT_KNOB_PROBES,
  MINT_SIGN_KNOB_PROBES,
  VERIFY_KNOB_PROBES,
  type KnobProbe,
} from "../__fixtures__/knob-probes.js";
import {
  KNOB_PATHS,
  probeWiresOf,
  runKnobProbe,
} from "../__fixtures__/run-knob-probe.js";
import { createTestDeployment, DEFAULT_CLOCK } from "../__fixtures__/test-deployment.js";
import { WIRE_TAGS, type Wire } from "../internal/registry/wire.js";
import {
  VERIFY_OPTION_KEYS,
  VERIFY_OPTION_PARITY,
} from "../internal/constants/verify-option-parity.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The KNOB MATRIX — a generated matrix: every option this package takes, on
 * every wire it can be stated on.
 *
 * Every option this package takes is threaded BY HAND into the call that
 * consumes it, once per wire and once per verb. A field left out of one of those
 * forwards is invisible: the compiler sees a well-typed object literal, and the
 * caller sees no error, because a dropped option does not fail — it does nothing.
 *
 * A row here therefore asserts something no feature scenario does: that ONE OPTION
 * IS READ. It is proved by DIFFERENCE — the same call is made twice, once with
 * the knob and once without — because a dropped knob is defined by the two being
 * the same.
 *
 * ⚠ Every reduce below pairs with a population check. A filter over an emptied
 * table passes trivially, and these tables are exactly the kind that get renamed
 * or split.
 */

type ProbeRow = [
  label: string,
  bag: keyof typeof KNOB_PATHS,
  key: string,
  probe: KnobProbe<never>,
];

const TABLES = {
  verify: VERIFY_KNOB_PROBES,
  mint: MINT_KNOB_PROBES,
  mintSign: MINT_SIGN_KNOB_PROBES,
  mintEncrypt: MINT_ENCRYPT_KNOB_PROBES,
  mintContext: MINT_CONTEXT_KNOB_PROBES,
  encrypt: ENCRYPT_KNOB_PROBES,
} as const;

/** Every probe in every table, flattened — the population every table test reduces over. */
const PROBES: ReadonlyArray<ProbeRow> = Object.entries(TABLES).flatMap(([bag, table]) =>
  Object.entries(table).map(
    ([key, probe]): ProbeRow => [
      `${bag}.${key}`,
      bag as keyof typeof KNOB_PATHS,
      key,
      probe as KnobProbe<never>,
    ],
  ),
);

/** The generated matrix: every probe × every wire it can be stated on. */
const MATRIX: ReadonlyArray<
  [string, keyof typeof KNOB_PATHS, string, KnobProbe<never>, Wire]
> = PROBES.flatMap(([label, bag, key, probe]) =>
  probeWiresOf(probe).map(
    (wire): [string, keyof typeof KNOB_PATHS, string, KnobProbe<never>, Wire] => [
      `${label} [${wire}]`,
      bag,
      key,
      probe,
      wire,
    ],
  ),
);

describe("Aegis — knob matrix", () => {
  // The anti-drift binding, and the reason `VERIFY_OPTION_KEYS` is worth keeping
  // public. Both tables are `satisfies` a `-?` mapped type over `VerifyOptions`,
  // so each is total and exact against the TYPE at compile time; this asserts at
  // RUNTIME that the two independently-authored tables agree, which is what a
  // cast past either `satisfies` would break. It is never the probe table
  // compared with a copy of itself.
  test("should probe exactly the options the parity table declares", () => {
    expect(VERIFY_OPTION_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(VERIFY_KNOB_PROBES).sort()).toEqual(
      [...VERIFY_OPTION_KEYS].sort(),
    );
  });

  // The recorded per-option wire contract. A CHANGE DETECTOR, not a correctness
  // check — the correctness of each row is what the matrix below demonstrates by
  // running it. It stays because an edit to what aegis promises across the two
  // wires must surface in review rather than in a consumer.
  test("should match the recorded wire-parity contract", () => {
    expect(VERIFY_OPTION_PARITY).toMatchSnapshot();
  });

  // The published key set pylon consumes. Snapshotted because it is a PUBLIC
  // value: a key appearing or disappearing changes how a consumer splits its own
  // matcher-and-knob bag, and pylon's hand-copy of this list has misrouted keys
  // twice.
  test("should publish the derived verify-option key set", () => {
    expect(VERIFY_OPTION_KEYS).toMatchSnapshot();
  });

  // `wires: "jose" | "cose"` already demands a `reason` in the type. Diverging
  // DEFAULTS cannot be expressed the same way, so it is asserted here: a row
  // where the two wires resolve differently is a claim about two specifications,
  // and it must say which.
  test("should justify every diverging default", () => {
    const unexplained = Object.entries(VERIFY_OPTION_PARITY)
      .filter(([, spec]) => spec.default.jose !== spec.default.cose)
      .filter(([, spec]) => !("reason" in spec && spec.reason))
      .map(([key]) => key);

    expect(Object.keys(VERIFY_OPTION_PARITY).length).toBeGreaterThan(0);
    expect(unexplained).toEqual([]);
  });

  // A probe states its outcome in exactly ONE of the two forms. Both at once is a
  // row whose verdict and whose observation could disagree, and the runner would
  // silently honour only the first.
  test("should state exactly one outcome form per probe", () => {
    const malformed = PROBES.filter(([, , , probe]) => {
      const verdict = probe.baseline !== undefined;
      const artifact = probe.observed !== undefined;

      return verdict === artifact;
    }).map(([label]) => label);

    expect(PROBES.length).toBeGreaterThan(0);
    expect(malformed).toEqual([]);
  });

  // THE MECHANISM, asserted as a property of the table. A verdict probe whose two
  // verdicts agree cannot demonstrate anything: both runs would already be
  // "correct" for a forward that never reads the option. The same holds inside
  // every per-wire override.
  test("should state a DIFFERENT verdict with and without every verdict knob", () => {
    const bodies = PROBES.flatMap(([label, , , probe]) => [
      [label, probe.baseline, probe.flipped] as const,
      ...WIRE_TAGS.map(
        (wire) =>
          [
            `${label} [${wire}]`,
            probe.overrides?.[wire]?.baseline,
            probe.overrides?.[wire]?.flipped,
          ] as const,
      ),
    ]).filter(([, baseline]) => baseline !== undefined);

    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.filter(([, baseline, flipped]) => baseline === flipped)).toEqual([]);
  });

  // An artifact probe must observe SOMETHING. An empty `observed` with no
  // `format` is a probe that asserts the token was built, which every probe's
  // baseline already established.
  test("should observe something on every artifact knob", () => {
    // A knob earns its row by changing SOMETHING observable: a named observation,
    // the artifact's own format, or the envelope around it. `wrapper` counts for
    // the same reason `format` does — a knob that only wraps the token leaves
    // `format` identical by design, so requiring a format change would read that
    // correct behaviour as an unobservable knob.
    const empty = PROBES.filter(
      ([, , , probe]) =>
        probe.observed !== undefined &&
        probe.observed.length === 0 &&
        probe.format === undefined &&
        probe.wrapper === undefined,
    ).map(([label]) => label);

    expect(PROBES.length).toBeGreaterThan(0);
    expect(empty).toEqual([]);
  });

  // Every probe is JSON: every option bag bottoms out in `Dict`, so a lambda or a
  // live `Date` compiles wherever a literal does and would then be silently
  // rewritten by any machine conversion. `DateCell` exists precisely so a date can survive this.
  test("should carry only JSON-serialisable values in every probe", () => {
    expect(PROBES.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(TABLES))).toEqual(TABLES);
  });

  // `unobservable` is the PERMANENT declaration — a specification or
  // serialisation fact — so it must cite one. A reason that names no
  // specification is either a code shortfall (which is a red probe) or an
  // unwritten probe, and both would hide here as prose.
  test("should cite a specification in every unobservable declaration", () => {
    const declarations = PROBES.flatMap(([label, , , probe]) =>
      Object.entries(probe.unobservable ?? {}).map(
        ([wire, reason]) => [`${label} [${wire}]`, reason] as const,
      ),
    );

    const uncited = declarations
      .filter(([, reason]) => !/RFC \d{4}/.test(reason ?? ""))
      .map(([label]) => label);

    expect(declarations.length).toBeGreaterThan(0);
    expect(uncited).toEqual([]);
  });

  // A probe that runs nowhere asserts nothing, and would sit in the table looking
  // like coverage — `test.each` simply never names it.
  test("should run every probe on at least one wire", () => {
    const silent = PROBES.filter(([, , , probe]) => probeWiresOf(probe).length === 0).map(
      ([label]) => label,
    );

    expect(PROBES.length).toBeGreaterThan(0);
    expect(silent).toEqual([]);
  });

  // THE MATRIX. Every knob, on every wire it can be stated on.
  test.each(MATRIX)("%s", async (_label, bag, key, probe, wire) => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    await runKnobProbe({
      bag,
      key,
      probe,
      // A fresh context per RUN, not per row: a `keys` step stocks the vault, and
      // a probe's two runs must not be able to see each other's residue.
      ctx: async () => {
        MockDate.set(new Date(DEFAULT_CLOCK));
        return createTestDeployment();
      },
      wire,
    });
  });
});
