import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createScenarioContext,
  DEFAULT_CLOCK,
  runScenario,
  wireOf,
  type ScenarioContext,
} from "../__fixtures__/run-scenario.js";
import { SCENARIOS, type Scenario } from "../__fixtures__/scenarios.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The CONFORMANCE table — the data-driven half of the aegis public-surface
 * suite. Every case lives as a row in `__fixtures__/scenarios.ts`; every step
 * lives in `__fixtures__/run-scenario.ts`. This file only wires the two together.
 *
 * A row states a CAPABILITY of aegis and asserts it. A red row is a live
 * shortfall against that capability; a green row is the capability holding. Rows
 * are never tuned toward either.
 */
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

  // `absentTwin` names the wire on which a row has NO counterpart, so it must
  // name the OTHER wire — a row marking its own would be documenting the absence
  // of itself. Checked rather than merely written down: the field's predecessor
  // was filtered on the row's OWN wire, which is never set, so the filter it fed
  // was dead and the asymmetry it documented went unread.
  //
  // ⚠ The population check first. `toEqual([])` is satisfied by a table in which
  // NOTHING sets `absentTwin` — including one where the field has been deleted
  // outright — so on its own it would go on passing after the invariant it guards
  // stopped existing.
  test("should never mark a scenario's own wire as the absent twin", () => {
    const selfMarked = SCENARIOS.filter(
      (scenario) => scenario.absentTwin?.[wireOf(scenario)] !== undefined,
    ).map((scenario) => scenario.id);

    expect(SCENARIOS.filter((scenario) => scenario.absentTwin).length).toBeGreaterThan(0);
    expect(selfMarked).toEqual([]);
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

  // `knownDefect` is PRESENT-TENSE: it describes how the code falls short today
  // and is deleted when the row goes green. So it must sit on exactly the rows
  // that currently FAIL. A defect note on a passing row is either a leftover or a
  // disposal note wearing a defect's clothes (those go in a `//` comment above
  // the step they explain); a failing row without one leaves its repairer nothing
  // to work from.
  //
  // Checked by RUNNING each row a second time — a test cannot observe another
  // test's verdict, and each row needs its own context anyway, since a `keys`
  // step stocks the vault it is handed.
  test("should carry a knownDefect on exactly the scenarios that currently fail", async () => {
    const mismatched: Array<string> = [];

    expect(SCENARIOS.length).toBeGreaterThan(0);

    for (const scenario of SCENARIOS) {
      MockDate.set(new Date(DEFAULT_CLOCK));

      const failed = await runScenario(scenario, await createScenarioContext()).then(
        () => false,
        () => true,
      );

      if (failed === (scenario.knownDefect === undefined)) {
        mismatched.push(
          failed
            ? `${scenario.id} — FAILS but names no knownDefect`
            : `${scenario.id} — PASSES but still carries a knownDefect`,
        );
      }
    }

    expect(mismatched).toEqual([]);
  });

  // EVERY row runs. `absentTwin` is documentation, not a skip mechanism.
  test.each(SCENARIOS.map((scenario): [string, Scenario] => [scenario.id, scenario]))(
    "%s",
    async (_id, scenario) => {
      await runScenario(scenario, ctx);
    },
  );
});
