import { isString, isUndefined } from "@lindorm/is";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { wiresOf } from "../__fixtures__/run-scenario.js";
import { SCENARIOS, type Scenario, type Wire } from "../__fixtures__/scenarios.js";
import { WIRE_TAGS } from "../internal/registry/wire.js";

/**
 * THE MIGRATION DELTA — the scenario table joined to the feature files.
 *
 * Scaffolding for the duplicate period: it makes the claim "every row of
 * `scenarios.ts` has scenarios under `__features__/`" re-runnable, and it is
 * deleted together with `scenarios.ts`.
 *
 * The table is read as DATA and the feature files as TEXT. The join key is the
 * row's `title`, written verbatim as the `Rule:` name. A scenario's wire is the
 * `jose:` / `cose:` prefix of its name — for an outline, the name with the
 * Examples row's cells substituted, as the runner names it.
 *
 * ⚠ A scenario with no wire prefix counts on EVERY wire cell of its row: the
 * static claim matcher takes a flat claim set and no token, so the table runs
 * such a row twice on one act, and a wire prefix on its scenario would be a lie.
 *
 * Asserted: every row has a scenario, every (row, wire) cell the table runs has
 * a scenario on that wire, and no scenario is attributed to no row. Reported in
 * the test names: the per-row scenario counts, and a row whose scenarios reach a
 * wire the table does not run. A row deliberately dropped from the features is
 * dropped from the table in the same change.
 */

type FeatureScenario = {
  /** `__features__/Aegis.x.feature:12` — the line the runner anchors the test to. */
  at: string;
  name: string;
  rule: string | undefined;
  wire: Wire | undefined;
};

const KEYWORDS = [
  "Feature",
  "Rule",
  "Background",
  "Scenario Outline",
  "Scenario Template",
  "Scenario",
  "Example",
  "Examples",
  "Scenarios",
] as const;

type Keyword = (typeof KEYWORDS)[number];

const KEYWORD = new RegExp(`^(${KEYWORDS.join("|")}):\\s*(.*)$`);
const DOC_STRING = /^("""|```)/;

const wireOf = (name: string): Wire | undefined =>
  WIRE_TAGS.find((wire) => name.startsWith(`${wire}: `));

const cellsOf = (row: string): Array<string> =>
  row
    .slice(1, row.lastIndexOf("|"))
    .split("|")
    .map((cell) => cell.trim());

/**
 * One scenario per `Scenario:` and per Examples row, each under the `Rule:`
 * above it. A doc-string body is skipped, so a keyword inside one is text.
 */
const scanFeature = (file: string, text: string): Array<FeatureScenario> => {
  const scenarios: Array<FeatureScenario> = [];
  let rule: string | undefined;
  let outline: string | undefined;
  let header: Array<string> | undefined;
  let inExamples = false;
  let docString: string | undefined;

  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    const at = `${file}:${index + 1}`;

    if (isString(docString)) {
      if (line.startsWith(docString)) docString = undefined;
      continue;
    }

    const fence = DOC_STRING.exec(line);

    if (fence) {
      docString = fence[1];
      continue;
    }

    if (line === "" || line.startsWith("#") || line.startsWith("@")) continue;

    const keyword = KEYWORD.exec(line);

    if (keyword) {
      const word = keyword[1] as Keyword;
      const name = keyword[2];

      inExamples = false;

      switch (word) {
        case "Feature":
          rule = undefined;
          outline = undefined;
          break;

        case "Rule":
          rule = name;
          outline = undefined;
          break;

        case "Background":
          outline = undefined;
          break;

        case "Scenario Outline":
        case "Scenario Template":
          outline = name;
          break;

        case "Scenario":
        case "Example":
          outline = undefined;
          scenarios.push({ at, name, rule, wire: wireOf(name) });
          break;

        case "Examples":
        case "Scenarios":
          inExamples = true;
          header = undefined;
          break;

        default: {
          const exhaustive: never = word;
          throw new Error(`unhandled keyword ${JSON.stringify(exhaustive)}`);
        }
      }
      continue;
    }

    if (!inExamples || !line.startsWith("|") || isUndefined(outline)) continue;

    const cells = cellsOf(line);

    if (isUndefined(header)) {
      header = cells;
      continue;
    }

    const name = header.reduce(
      (substituted, column, position) =>
        substituted.replaceAll(`<${column}>`, cells[position]),
      outline,
    );

    scenarios.push({ at, name, rule, wire: wireOf(name) });
  }

  return scenarios;
};

const SRC = new URL("../", import.meta.url);

const FEATURES = readdirSync(SRC, { encoding: "utf8", recursive: true })
  .filter((name) => name.endsWith(".feature"))
  .sort();

const TESTS: ReadonlyArray<FeatureScenario> = FEATURES.flatMap((file) =>
  scanFeature(file, readFileSync(new URL(file, SRC), "utf8")),
);

const TITLES = new Set(SCENARIOS.map((row) => row.title));

const isAttributed = (scenario: FeatureScenario): boolean =>
  isString(scenario.rule) && TITLES.has(scenario.rule);

const ORPHANS = TESTS.filter((scenario) => !isAttributed(scenario));

const label = (scenario: FeatureScenario): string =>
  isString(scenario.rule)
    ? `${scenario.at} — Rule "${scenario.rule}" > "${scenario.name}"`
    : `${scenario.at} — "${scenario.name}", under no Rule`;

const onWire = (
  own: ReadonlyArray<FeatureScenario>,
  wire: Wire,
): ReadonlyArray<FeatureScenario> =>
  own.filter((scenario) => scenario.wire === wire || isUndefined(scenario.wire));

/** The cells the table runs with nothing on them — what the per-row test asserts against. */
const gapsOf = (row: Scenario, own: ReadonlyArray<FeatureScenario>): Array<string> =>
  own.length === 0
    ? [`${row.id} has no scenario`]
    : wiresOf(row)
        .filter((wire) => onWire(own, wire).length === 0)
        .map((wire) => `${row.id} [${wire}] has no scenario on this wire`);

/** The wires the row's scenarios name and the table does not run — reported, never asserted. */
const beyondOf = (row: Scenario, own: ReadonlyArray<FeatureScenario>): Array<Wire> =>
  WIRE_TAGS.filter(
    (wire) =>
      !wiresOf(row).includes(wire) && own.some((scenario) => scenario.wire === wire),
  );

const describeRow = (row: Scenario, own: ReadonlyArray<FeatureScenario>): string => {
  const runs = wiresOf(row);
  const counts = WIRE_TAGS.map((wire) => `${wire} ${onWire(own, wire).length}`);
  const wireless = own.filter((scenario) => isUndefined(scenario.wire)).length;
  const beyond = beyondOf(row, own);

  return [
    `${row.id}: ${counts.join(", ")}`,
    wireless > 0 ? ` (${wireless} wire-less, counted on every cell)` : "",
    runs.length < WIRE_TAGS.length ? ` — the table runs [${runs.join(", ")}]` : "",
    beyond.length > 0
      ? ` — scenarios on [${beyond.join(", ")}], which the table does not run`
      : "",
  ].join("");
};

type Attribution = [label: string, row: Scenario, own: ReadonlyArray<FeatureScenario>];

const ROWS: ReadonlyArray<Attribution> = SCENARIOS.map((row) => {
  const own = TESTS.filter((scenario) => scenario.rule === row.title);

  return [describeRow(row, own), row, own];
});

const CELLS = SCENARIOS.reduce((count, row) => count + wiresOf(row).length, 0);

const WIRELESS = TESTS.filter(
  (scenario) => isAttributed(scenario) && isUndefined(scenario.wire),
).length;

const FLAGS =
  ROWS.reduce(
    (count, [, row, own]) => count + gapsOf(row, own).length + beyondOf(row, own).length,
    0,
  ) + ORPHANS.length;

const CENSUS = `rows ${SCENARIOS.length}, table cells ${CELLS}, gherkin tests ${TESTS.length - ORPHANS.length} (${WIRELESS} wire-less, each counted on both cells), orphans ${ORPHANS.length}, flags ${FLAGS}`;

describe(`Aegis — migration delta: ${CENSUS}`, () => {
  // Every reduction below holds trivially over an empty table or an empty
  // feature directory, so the populations come first.
  test("should read rows and scenarios", () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(FEATURES.length).toBeGreaterThan(0);
    expect(TESTS.length).toBeGreaterThan(0);
  });

  test("should attribute every scenario to a row through its Rule", () => {
    expect(ORPHANS.map(label)).toEqual([]);
  });

  test.each(ROWS)("%s", (_label, row, own) => {
    expect(gapsOf(row, own)).toEqual([]);
  });
});
