import { isString } from "@lindorm/is";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createScenarioContext,
  DEFAULT_CLOCK,
  knownDefectOn,
  runScenario,
  selfMarkedWireOf,
  wiresOf,
  type ScenarioContext,
} from "../__fixtures__/run-scenario.js";
import { WIRE_TAGS } from "../internal/registry/wire.js";
import {
  SCENARIOS,
  WITHDRAWN_CAPABILITIES,
  type Scenario,
  type Wire,
} from "../__fixtures__/scenarios.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The SCENARIO MATRIX — the first of the conformance suite's three generated
 * matrices, and the data-driven half of the aegis public-surface suite. Every
 * case lives as a row in `__fixtures__/scenarios.ts`; every step lives in
 * `__fixtures__/run-scenario.ts`. This file only wires the two together, and
 * generates the matrix: one domain scenario × every wire it runs on.
 *
 * A row states a CAPABILITY of aegis and asserts it. A red row is a live
 * shortfall against that capability; a green row is the capability holding. Rows
 * are never tuned toward either.
 *
 * ⚠ COVERAGE IS THE DEFAULT. A row runs on EVERY wire unless it declares
 * otherwise in `unsupported`, with a reason — the inversion of what this table
 * did first, where a row named a concrete kit and covered one wire silently.
 */

/** Every (row, wire) pair the matrix runs — the generated matrix itself. */
const MATRIX: ReadonlyArray<[string, Scenario, Wire]> = SCENARIOS.flatMap((scenario) =>
  wiresOf(scenario).map((wire): [string, Scenario, Wire] => [
    `${scenario.id} [${wire}]`,
    scenario,
    wire,
  ]),
);

describe("Aegis — conformance", () => {
  let ctx: ScenarioContext;

  beforeEach(async () => {
    // ⚠ BEFORE the context is built. `createScenarioContext` runs
    // `amphora.setup()`, which reads the clock, and `applySetup` resets it only
    // once the test itself is running — so without this the vault would be built
    // at whatever instant the previous row left MockDate on.
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createScenarioContext();
  });

  // Ids are how a failure is traced back to the capability it belongs to, and how
  // a row is grepped for. A duplicate id would silently merge two rows in the
  // report.
  //
  // ⚠ The population check first, here and on every other test that reduces over
  // the table: uniqueness holds TRIVIALLY over an empty table, so without it this
  // would go on passing over a table that had been emptied or renamed away.
  test("should carry a unique id on every scenario", () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);

    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // THE COVERAGE DEBT — the mechanism that makes coverage the default rather
  // than a habit. A row that pins itself to one wire (a concrete kit, a concrete
  // format) leaves the other wire uncovered, and must say so with a reason. A
  // row that says nothing runs everywhere.
  //
  // Before this test the field it replaces was pure documentation: nothing
  // demanded one, so a row could cover JOSE alone and read exactly like a row
  // that had considered COSE and found it inapplicable. SIX rows in this table
  // were hand-written `-on-the-cose-wire` copies of another row — which is what
  // remembering-to-write-the-twin looks like when it half works — and nothing
  // said which of the remaining rows should have had one.
  test("should declare a reason for every wire a scenario does not run on", () => {
    const undeclared = SCENARIOS.flatMap((scenario) => {
      const running = new Set(wiresOf(scenario));

      return WIRE_TAGS.filter((wire) => !running.has(wire))
        .filter((wire) => (scenario.unsupported?.[wire] ?? "").trim().length === 0)
        .map((wire) => `${scenario.id} — does not run on ${wire}, and states no reason`);
    });

    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(undeclared).toEqual([]);
  });

  // A row PINNED to one wire can never declare that wire unsupported — that is a
  // row documenting the absence of itself.
  //
  // ⚠ Read off `selfMarkedWireOf`, which derives the answer from the row's two
  // independent declarations (the artifact it builds, the reasons it states).
  // This test has now been dead TWICE: first filtered on a field a row never
  // sets, then rewritten to ask whether any wire in `wiresOf(scenario)` appeared
  // in `unsupported` — the exact negation of the filter that had just produced
  // that array, so it was `[]` for every table that could ever be written. The
  // predicate lives in the interpreter and is exercised on a row that DOES
  // violate it (`run-scenario.test.ts`), which is the only thing that shows it can
  // still fail at all.
  test("should never mark the wire a scenario pins itself to as unsupported", () => {
    const selfMarked = SCENARIOS.filter(
      (scenario) => selfMarkedWireOf(scenario) !== undefined,
    ).map((scenario) => scenario.id);

    expect(SCENARIOS.filter((scenario) => scenario.unsupported).length).toBeGreaterThan(
      0,
    );
    expect(selfMarked).toEqual([]);
  });

  // Every row must reach at least one wire. A row whose every wire is declared
  // unsupported asserts nothing at all, and would sit in the table looking like
  // coverage — the population checks above count it, and `test.each` would simply
  // never name it.
  test("should run every scenario on at least one wire", () => {
    const unrun = SCENARIOS.filter((scenario) => wiresOf(scenario).length === 0).map(
      (scenario) => scenario.id,
    );

    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(unrun).toEqual([]);
  });

  // A row that runs on EVERY wire is the default form, and the table is only as
  // good as its share of them: a table of one-wire rows with dutiful reasons
  // satisfies every test above while covering each wire half the time. Pin the
  // ratio so that drift is visible in review rather than discovered later.
  //
  // ⚠ Measured on the wires a row RUNS ON, never on `pinnedWireOf` alone — that
  // is blind to `unsupported`, so a row wire-agnostic by artifact but running on
  // JOSE alone counted as full coverage, and a table where EVERY row carried a
  // dutiful reason would have scored 1.0. That is the exact drift this test
  // names.
  test("should state most capabilities on every wire", () => {
    const everywhere = SCENARIOS.filter(
      (scenario) => wiresOf(scenario).length === WIRE_TAGS.length,
    );

    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(everywhere.length / SCENARIOS.length).toBeGreaterThan(0.5);
  });

  // A row must be trivially SERIALISABLE — that is the whole constraint behind
  // the table's "no function values in a row" rule, and it is what makes a
  // machine conversion to Gherkin possible at all. Prose alone does not enforce
  // it: every option bag bottoms out in `Dict`, so a lambda compiles wherever one
  // does and would then be dropped silently by the conversion.
  test("should carry only JSON-serialisable values in every scenario", () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(SCENARIOS))).toEqual(SCENARIOS);
  });

  /**
   * ⭐ A WITHDRAWN CAPABILITY STAYS WITHDRAWN, or its record goes with it.
   *
   * `WITHDRAWN_CAPABILITIES` is how `scenarios.ts` says a promise it once made no
   * longer holds — without it a reader of the table alone concludes the opposite
   * of what the code does, which is exactly what happened when
   * `an-unrecognised-critical-parameter-is-refused` was OVERWRITTEN in place by a
   * row stating a different capability. This binds the record to the table: a row
   * reinstated under a withdrawn id must delete the record in the same change,
   * rather than leaving the two contradicting each other.
   */
  test("each withdrawal's id agrees with whether its row still exists", () => {
    const live = new Set(SCENARIOS.map((scenario) => scenario.id));

    // A WHOLE-row withdrawal whose id is live is a capability reinstated under its
    // old name while the record still says it is gone.
    const reinstated = WITHDRAWN_CAPABILITIES.filter(
      ({ scope, id }) => scope === "row" && live.has(id),
    ).map(({ id }) => id);

    // A PARTIAL withdrawal whose id is NOT live is a record that outlived its row —
    // it should have become a whole-row withdrawal when the row went.
    const orphaned = WITHDRAWN_CAPABILITIES.filter(
      ({ scope, id }) => scope === "partial" && !live.has(id),
    ).map(({ id }) => id);

    expect(WITHDRAWN_CAPABILITIES.length).toBeGreaterThan(0);
    expect({ reinstated, orphaned }).toEqual({ reinstated: [], orphaned: [] });
  });

  /**
   * ⚠ NOT "both arms are populated" — a table holding only whole-row withdrawals
   * is a legitimate state, and asserting the observed mix would freeze today's
   * data as though it were the rule.
   *
   * ⛔ IT READS THE VALUES, NOT THE TYPE. `scope` is a closed union, so a
   * `filter` over it narrows to `never` and could not fail for typed data — the
   * check would be a tautology. These records are read by a runtime binding, and
   * the input a binding has to survive is data that reached it WITHOUT passing
   * the compiler: a hand-edited fixture, a JSON round trip. So the set is
   * compared as strings.
   */
  test("every withdrawal declares a scope the binding above can act on", () => {
    const declared = new Set<string>(["row", "partial"]);
    const unknown = (
      WITHDRAWN_CAPABILITIES as ReadonlyArray<{ id: string; scope: string }>
    )
      .filter(({ scope }) => !declared.has(scope))
      .map(({ id }) => id);

    // The population check, as on every other reduce over this table: a filter
    // over an emptied array is trivially green.
    expect(WITHDRAWN_CAPABILITIES.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });

  test("every withdrawal states what the package does instead", () => {
    // A record that names no replacement behaviour is a memo: the point is that a
    // reader learns what IS true now, not merely that something stopped.
    const thin = WITHDRAWN_CAPABILITIES.filter(
      ({ stated, because, insteadNow }) =>
        !stated.trim() || !because.trim() || !insteadNow.trim(),
    ).map(({ id }) => id);

    expect(WITHDRAWN_CAPABILITIES.length).toBeGreaterThan(0);
    expect(thin).toEqual([]);
  });

  // `knownDefect` is PRESENT-TENSE: it describes how the code falls short today
  // and is deleted when the row goes green. So it must sit on exactly the rows
  // that currently FAIL. A defect note on a passing row is either a leftover or a
  // disposal note wearing a defect's clothes (those go in a `//` comment above
  // the step they explain); a failing row without one leaves its repairer nothing
  // to work from.
  //
  // Checked by RUNNING each row a second time — a test cannot observe another
  // test's verdict, and each row needs its own context anyway, since a `keys`
  // step stocks the vault it is handed. Run per WIRE: a capability that holds on
  // one wire and not the other is a real shortfall, and a row-level verdict would
  // average the two away.
  //
  // ⚠ The DECLARATION is resolved per wire too (`knownDefectOn`), which it was
  // not. This check has always been per CELL while the field could only speak for
  // the whole row, so a row green on JOSE and red on COSE reported
  // `"[jose] — PASSES but still carries a knownDefect"` however it was written —
  // and the two ways out were both dishonest: `unsupported` is reserved for a
  // SPECIFICATION reason and would be a lie about a wire that works, and
  // splitting into two wire-pinned rows owes the working wire the same lie. Two
  // such defects exist in the table today (`decrypt` on the COSE wire), and
  // before this they could not be pinned at all.
  test("should carry a knownDefect on exactly the scenario cells that currently fail", async () => {
    const mismatched: Array<string> = [];

    expect(MATRIX.length).toBeGreaterThan(0);

    for (const [label, scenario, wire] of MATRIX) {
      MockDate.set(new Date(DEFAULT_CLOCK));

      const failed = await runScenario(
        scenario,
        await createScenarioContext(),
        wire,
      ).then(
        () => false,
        () => true,
      );

      if (failed === (knownDefectOn(scenario, wire) === undefined)) {
        mismatched.push(
          failed
            ? `${label} — FAILS but names no knownDefect`
            : `${label} — PASSES but still carries a knownDefect`,
        );
      }
    }

    expect(mismatched).toEqual([]);
  });

  // A per-wire declaration must name a wire the row RUNS ON. An entry for a wire
  // the row never reaches describes a cell that does not exist, so it can never
  // be falsified and never be deleted — the defect list's own version of a check
  // that cannot fail.
  test("should declare every knownDefect for a wire its scenario runs on", () => {
    const stranded = SCENARIOS.flatMap((scenario) => {
      const declaration = scenario.knownDefect;

      if (declaration === undefined || isString(declaration)) return [];

      const running = new Set<Wire>(wiresOf(scenario));

      return Object.keys(declaration)
        .filter((wire) => !running.has(wire as Wire))
        .map(
          (wire) =>
            `${scenario.id} — declares a defect on ${wire}, which it does not run on`,
        );
    });

    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(stranded).toEqual([]);
  });

  // THE MATRIX. Every row, on every wire it runs on.
  test.each(MATRIX)("%s", async (_label, scenario, wire) => {
    await runScenario(scenario, ctx, wire);
  });
});
