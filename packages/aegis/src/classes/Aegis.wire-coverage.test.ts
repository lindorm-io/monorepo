import { isString, isUndefined } from "@lindorm/is";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { WIRE_TAGS, type Wire } from "../internal/registry/wire.js";

/**
 * WIRE COVERAGE — the feature files' own integrity, read as text.
 *
 * A `Rule:` runs on the wires its scenarios name: the `jose:` / `cose:` prefix
 * of a scenario name — for an outline, the name with each Examples row's cells
 * substituted — or an Examples `wire` column. A Rule naming one wire alone has
 * left the other uncovered on purpose and says why in its own description, in
 * a sentence opening `The <other> wire has no scenario:`. The opening is fixed
 * so the check is a substring test and never a judgement about prose. A Rule
 * naming no wire is not counted. Most Rules run on both wires, and the share is
 * pinned so that drift is visible in review rather than discovered later.
 *
 * Reads the feature files alone: `@lindorm/gherkin` drops descriptions before
 * its runtime model exists, so a reason is readable only off the text, and
 * nothing here depends on the scenario table.
 */

type FeatureRule = {
  /** `__features__/Aegis.x.feature:12` — the `Rule:` line. */
  at: string;
  name: string;
  /** The Rule's own description, joined on single spaces so a sentence wrapped across lines reads whole. */
  description: string;
  wires: ReadonlySet<Wire>;
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

const isWire = (cell: string): cell is Wire => WIRE_TAGS.includes(cell as Wire);

const wireOf = (name: string): Wire | undefined =>
  WIRE_TAGS.find((wire) => name.startsWith(`${wire}: `));

const cellsOf = (row: string): Array<string> =>
  row
    .slice(1, row.lastIndexOf("|"))
    .split("|")
    .map((cell) => cell.trim());

const reasonOf = (wire: Wire): string => `The ${wire} wire has no scenario:`;

type OpenRule = {
  at: string;
  name: string;
  description: Array<string>;
  wires: Set<Wire>;
  describing: boolean;
};

const close = (rule: OpenRule): FeatureRule => ({
  at: rule.at,
  name: rule.name,
  description: rule.description.join(" "),
  wires: rule.wires,
});

/**
 * One entry per `Rule:`, with the wires its scenarios name. The description is
 * the free text between the `Rule:` line and the first keyword or tag under it.
 * A doc-string body is skipped, so a keyword inside one is text.
 */
const scanFeature = (file: string, text: string): Array<FeatureRule> => {
  const rules: Array<FeatureRule> = [];
  let rule: OpenRule | undefined;
  let outline: string | undefined;
  let header: Array<string> | undefined;
  let inExamples = false;
  let docString: string | undefined;

  const name = (scenario: string): void => {
    const wire = wireOf(scenario);
    if (rule && wire) rule.wires.add(wire);
  };

  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.trim();

    if (isString(docString)) {
      if (line.startsWith(docString)) docString = undefined;
      continue;
    }

    const fence = DOC_STRING.exec(line);

    if (fence) {
      docString = fence[1];
      continue;
    }

    if (line === "" || line.startsWith("#")) continue;

    if (line.startsWith("@")) {
      if (rule) rule.describing = false;
      continue;
    }

    const keyword = KEYWORD.exec(line);

    if (keyword) {
      const word = keyword[1] as Keyword;
      const title = keyword[2];

      inExamples = false;
      if (rule) rule.describing = false;

      switch (word) {
        case "Feature":
          if (rule) rules.push(close(rule));
          rule = undefined;
          outline = undefined;
          break;

        case "Rule":
          if (rule) rules.push(close(rule));
          rule = {
            at: `${file}:${index + 1}`,
            name: title,
            description: [],
            wires: new Set(),
            describing: true,
          };
          outline = undefined;
          break;

        case "Background":
          outline = undefined;
          break;

        case "Scenario Outline":
        case "Scenario Template":
          outline = title;
          break;

        case "Scenario":
        case "Example":
          outline = undefined;
          name(title);
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

    if (rule?.describing) {
      rule.description.push(line);
      continue;
    }

    if (!inExamples || !line.startsWith("|") || isUndefined(outline)) continue;

    const cells = cellsOf(line);

    if (isUndefined(header)) {
      header = cells;
      continue;
    }

    name(
      header.reduce(
        (substituted, column, position) =>
          substituted.replaceAll(`<${column}>`, cells[position]),
        outline,
      ),
    );

    const column = header.indexOf("wire");
    const cell = column === -1 ? undefined : cells[column];

    if (rule && isString(cell) && isWire(cell)) rule.wires.add(cell);
  }

  if (rule) rules.push(close(rule));

  return rules;
};

const SRC = new URL("../", import.meta.url);

const FEATURES = readdirSync(SRC, { encoding: "utf8", recursive: true })
  .filter((file) => file.endsWith(".feature"))
  .sort();

const RULES: ReadonlyArray<FeatureRule> = FEATURES.flatMap((file) =>
  scanFeature(file, readFileSync(new URL(file, SRC), "utf8")),
);

const NAMING = RULES.filter((rule) => rule.wires.size > 0);
const ONE_WIRE = NAMING.filter((rule) => rule.wires.size < WIRE_TAGS.length);
const BOTH_WIRES = NAMING.filter((rule) => rule.wires.size === WIRE_TAGS.length);

/** The wires the Rule does not run on and gives no reason for. */
const unexplainedOf = (rule: FeatureRule): Array<string> =>
  WIRE_TAGS.filter((wire) => !rule.wires.has(wire))
    .filter((wire) => !rule.description.includes(reasonOf(wire)))
    .map(
      (wire) =>
        `${rule.at} — Rule "${rule.name}" has no ${wire} scenario and no sentence opening "${reasonOf(wire)}"`,
    );

type Coverage = [label: string, rule: FeatureRule];

const ONE_WIRE_RULES: ReadonlyArray<Coverage> = ONE_WIRE.map((rule) => [
  `${rule.at} — Rule "${rule.name}" runs on ${[...rule.wires].join(", ")} alone`,
  rule,
]);

const RATIO = BOTH_WIRES.length / NAMING.length;

const CENSUS = `rules ${RULES.length}, naming a wire ${NAMING.length}, one wire ${ONE_WIRE.length}, both wires ${BOTH_WIRES.length}, ratio ${RATIO.toFixed(3)}`;

describe(`Aegis — wire coverage: ${CENSUS}`, () => {
  // Every reduction below holds trivially over an empty feature directory, so
  // the populations come first.
  test("should read rules that name a wire", () => {
    expect(FEATURES.length).toBeGreaterThan(0);
    expect(RULES.length).toBeGreaterThan(0);
    expect(NAMING.length).toBeGreaterThan(0);
  });

  test.each(ONE_WIRE_RULES)("%s", (_label, rule) => {
    expect(unexplainedOf(rule)).toEqual([]);
  });

  // A Rule that runs on every wire is the default form, and a suite of one-wire
  // Rules with dutiful reasons satisfies the check above while covering each
  // wire half the time.
  test("should state most rules on every wire", () => {
    expect(RATIO).toBeGreaterThan(0.5);
  });
});
