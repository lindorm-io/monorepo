import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  KIT_CELL_CENSUS,
  PROFILE_CENSUS,
  RULE_KIND_CENSUS,
  SHAPE_RULE_CENSUS,
  type CensusEntry,
} from "../__fixtures__/coverage-census.js";
import {
  MATCH_VIOLATIONS,
  REQUIRED_WHEN_VIOLATIONS,
  SHAPE_VIOLATIONS,
  type Violation,
} from "../__fixtures__/policy-exercises.js";
import {
  directionsOf,
  isDateSample,
  runPolicyExercise,
  violationsOf,
} from "../__fixtures__/run-policy-exercise.js";
import { VERIFY_KNOB_PROBES } from "../__fixtures__/knob-probes.js";
import {
  CLAIM_DISPOSITIONS,
  HEADER_DISPOSITIONS,
} from "../__fixtures__/spec-dispositions.js";
import { VERIFY_OPTION_KEYS } from "../internal/constants/verify-option-parity.js";
import { CLAIM_SPECS } from "../internal/claims/claims-registry.js";
import { HEADER_SPECS } from "../internal/header/header-registry.js";
import { createProfileRegistry } from "../internal/profiles/registry.js";
import { SHAPE_RULES } from "../internal/profiles/shape-rules.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import type { Dict } from "@lindorm/types";
import type { Direction, PolicyRule, TokenProfile } from "../types/index.js";

/**
 * THE META-TEST — the suite that asks whether the other suites cover anything.
 *
 * Three generated matrices now run: the SCENARIO matrix (a capability × every
 * wire), the KNOB matrix (an option × every wire, proved by difference) and the
 * PER-SPEC matrix (a registry entry × every wire). Each is total over its OWN
 * table, and none of them can see the collections it does not enumerate. A
 * profile nothing mints, a policy rule nothing violates, a capability cell
 * nothing reads: all three sit inside green matrices, and the last one is not
 * hypothetical — `atLeastOneOf` was declared by a profile, enforced on the mint
 * path only, and accepted on arrival for as long as the rule existed.
 *
 * So every enumerated collection is bound here, by one of exactly two mechanisms:
 *
 *  - a TOTAL MAPPED TYPE where a type-level union exists, which makes a new
 *    member a COMPILE error rather than a silent omission;
 *  - a RUNTIME comparison against the real collection where none does.
 *
 * ⚠ And the policy rules are not merely censused — they are RUN. Every one of the
 * declared rule instances is exercised by DIFFERENCE: the enforcer is called on
 * the profile's own baseline and again on an input that violates the rule, and
 * the violation must report a failure the baseline did not. Most of those inputs
 * are DERIVED from the rule itself, so they cannot go stale when a profile edits
 * its own claim list.
 */

/** Every declared policy-rule INSTANCE, derived from the profiles themselves. */
type RuleInstance = [label: string, profile: TokenProfile, rule: PolicyRule];

/**
 * The profiles, read back through the registry's own resolver — the door `mint`
 * and `verify` go through.
 *
 * ⚠ Driven by the CENSUS key set, because the registry's built-in list is not
 * exported and the public surface offers no enumeration. That makes the binding
 * one-directional at runtime: a censused profile that does not resolve fails
 * here, while a profile added to the registry with no census entry is caught at
 * COMPILE time instead, by the census being a total mapped type over
 * `keyof BuiltInProfiles`. Both directions are held; only one of them is held at
 * runtime.
 */
const registry = createProfileRegistry();

const PROFILES: ReadonlyArray<TokenProfile> = Object.keys(PROFILE_CENSUS).map((name) =>
  registry.resolve(name),
);

const INSTANCES: ReadonlyArray<RuleInstance> = PROFILES.flatMap((profile) =>
  profile.policy.map(
    (rule, index): RuleInstance => [
      `${profile.name}#${index}:${rule.rule}`,
      profile,
      rule,
    ],
  ),
);

/**
 * Every EXERCISE those instances yield — a `required` rule yields one per claim,
 * and EVERY rule yields one per DIRECTION it declares.
 *
 * ⚠ The direction fan-out is what makes the matrix mean what its name says. It
 * used to take the first direction a rule listed, and all forty-six list `"mint"`
 * first, so every exercise ran the mint path and the verify path was never
 * touched — the enforcer could have skipped `direction === "verify"` outright
 * with the whole matrix green. That is the same shortfall as the one this suite
 * was built for, one level up: a rule enforced on the issuing half and not on the
 * receiving half is exactly what a relying party cannot see.
 */
type Exercise = [
  label: string,
  profile: TokenProfile,
  rule: PolicyRule,
  violation: Violation,
  drop: ReadonlyArray<string>,
  direction: Direction,
];

const EXERCISES: ReadonlyArray<Exercise> = INSTANCES.flatMap(([label, profile, rule]) =>
  violationsOf(profile, rule).flatMap((item) =>
    directionsOf(rule).map(
      (direction): Exercise => [
        `${label} ${item.label} on ${direction}`,
        profile,
        rule,
        item.violation,
        item.drop,
        direction,
      ],
    ),
  ),
);

const censusValues = (census: Record<string, CensusEntry>): ReadonlyArray<CensusEntry> =>
  Object.values(census);

describe("Aegis — meta coverage", () => {
  // --- the collections, bound to their census ------------------------------

  // The census is TOTAL over `keyof BuiltInProfiles` at compile time. That binds
  // it to the TYPE; this binds it to the REGISTRY, which is the artifact that
  // decides what `mint` and `verify` actually resolve. A profile added to one and
  // not the other fails here.
  test("should census exactly the profiles the registry resolves", () => {
    expect(PROFILES.length).toBeGreaterThan(0);
    expect(PROFILES.map((profile) => profile.name).sort()).toEqual(
      Object.keys(PROFILE_CENSUS).sort(),
    );
  });

  // `SHAPE_RULES` is the runtime table the enforcer dispatches through, and it is
  // itself `Record<ShapeRuleName, …>`. Comparing the census to it therefore binds
  // census -> type -> implementation table, all three.
  test("should census exactly the shape rules the enforcer dispatches", () => {
    expect(Object.keys(SHAPE_RULES).length).toBeGreaterThan(0);
    expect(Object.keys(SHAPE_RULE_CENSUS).sort()).toEqual(
      Object.keys(SHAPE_RULES).sort(),
    );
  });

  // A rule KIND with no declared instance is a vocabulary member nothing uses —
  // enforceable in principle, unexercised in fact.
  test("should declare at least one instance of every censused rule kind", () => {
    const declared = new Set(INSTANCES.map(([, , rule]) => rule.rule));

    expect(INSTANCES.length).toBeGreaterThan(0);
    expect(
      Object.keys(RULE_KIND_CENSUS).filter((kind) => !declared.has(kind as never)),
    ).toEqual([]);
  });

  // …and the converse: a kind declared by a profile with no census entry.
  test("should census every rule kind the profiles actually declare", () => {
    const uncensused = INSTANCES.map(([, , rule]) => rule.rule).filter(
      (kind) => RULE_KIND_CENSUS[kind] === undefined,
    );

    expect(INSTANCES.length).toBeGreaterThan(0);
    expect([...new Set(uncensused)]).toEqual([]);
  });

  // The 49 cells, bound to the real table rather than to the type alone. The
  // mapped type makes a new KIT or a new COLUMN a compile error; this catches a
  // row or column renamed on one side.
  test("should census every kit-capability cell", () => {
    const formats = Object.keys(KIT_CAPABILITIES);
    const columns = Object.keys(KIT_CAPABILITIES.jwt);

    expect(formats.length).toBeGreaterThan(0);
    expect(columns.length).toBeGreaterThan(0);
    expect(Object.keys(KIT_CELL_CENSUS).sort()).toEqual([...formats].sort());

    for (const format of formats) {
      expect(
        Object.keys(KIT_CELL_CENSUS[format as never]).sort(),
        `${format} census columns`,
      ).toEqual([...columns].sort());
    }
  });

  // The option surface is bound by the KNOB matrix, which drives one probe per
  // `VerifyOptions` key off the parity table. Restated here as the census's option
  // clause so the meta suite lists every collection, not most of them.
  test("should probe every verify option the published key set names", () => {
    expect(VERIFY_OPTION_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(VERIFY_KNOB_PROBES).sort()).toEqual(
      [...VERIFY_OPTION_KEYS].sort(),
    );
  });

  // The registry surface is bound by the PER-SPEC matrix. Same restatement, same
  // reason: a collection missing from this file is a collection nobody is
  // counting.
  // ⚠ Compared per COLLECTION and by NAME, never as one total. Two sums are
  // equal in more ways than one: a claim dropped from the registry cancels a
  // header added to it, and the count agrees while both tables are wrong. And a
  // count agrees with itself even when the two sides name entirely different
  // entries, so the names are what is compared and an empty registry — which
  // would satisfy any equality — is refused outright.
  test("should dispose of every registry entry", () => {
    expect(CLAIM_SPECS.length).toBeGreaterThan(0);
    expect(HEADER_SPECS.length).toBeGreaterThan(0);

    expect(Object.keys(CLAIM_DISPOSITIONS).sort()).toEqual(
      CLAIM_SPECS.map((spec) => spec.domain).sort(),
    );
    expect(Object.keys(HEADER_DISPOSITIONS).sort()).toEqual(
      HEADER_SPECS.map((spec) => spec.domain).sort(),
    );
  });

  // --- the census entries themselves ---------------------------------------

  // ⚠ `declared` IS THE ESCAPE HATCH — it means nothing runs the member — so it
  // owes a reason, and `reader` owes a `file:line`. Without both, "exercised
  // somewhere" is prose that reads as coverage.
  test("should justify every census entry that names no runnable exercise", () => {
    const entries = [
      ...censusValues(PROFILE_CENSUS),
      ...censusValues(RULE_KIND_CENSUS),
      ...censusValues(SHAPE_RULE_CENSUS),
      ...Object.values(KIT_CELL_CENSUS).flatMap((row) => censusValues(row)),
    ];

    const unjustified = entries.filter(
      (entry) => entry.exercised === "declared" && !entry.reason.trim(),
    );
    const unsited = entries.filter(
      (entry) => entry.exercised === "reader" && !/^src\/.+\.ts:\d+$/.test(entry.site),
    );

    expect(entries.length).toBeGreaterThan(0);
    expect(unjustified).toEqual([]);
    expect(unsited).toEqual([]);
  });

  // The measurement the census exists to make VISIBLE: seven of the forty-nine
  // capability cells have a production reader. The table's premise is that a kit
  // reads its own row, and for six-sevenths of it that is not yet true. Pinned so
  // the number moves in review — up when a kit starts reading its row, and never
  // silently down.
  test("should record how many capability cells a kit actually reads", () => {
    const cells = Object.values(KIT_CELL_CENSUS).flatMap((row) => Object.values(row));

    expect(cells.length).toBe(49);
    expect(cells.filter((cell) => cell.exercised === "reader").length).toBe(7);
    expect(cells.filter((cell) => cell.exercised === "observed").length).toBeGreaterThan(
      0,
    );
  });

  // --- the policy-rule exercises -------------------------------------------

  // Every declared instance must yield at least one runnable exercise. An
  // instance that yields none is a rule the matrix below silently skips.
  test("should yield a runnable exercise for every declared policy-rule instance", () => {
    const exercised = new Set(EXERCISES.map(([label]) => label.split(" ")[0]));

    expect(INSTANCES.length).toBeGreaterThan(0);
    expect(
      INSTANCES.map(([label]) => label).filter((label) => !exercised.has(label)),
    ).toEqual([]);
  });

  // The three violation tables carry the inputs no machine can derive, and each
  // is bound to the rules that need it — a violation for a rule nobody declares
  // is dead data, and a declared rule with no violation would throw in
  // `violationsOf` rather than silently skip, which the test above then catches.
  test("should declare a match violation for exactly the conditions in use", () => {
    const claims = INSTANCES.filter(([, , rule]) => rule.rule === "match").map(
      ([, , rule]) => Object.keys((rule as { condition: object }).condition)[0],
    );

    expect(claims.length).toBeGreaterThan(0);
    expect(Object.keys(MATCH_VIOLATIONS).sort()).toEqual([...new Set(claims)].sort());
  });

  test("should declare a requiredWhen violation for exactly the instances in use", () => {
    const keys = INSTANCES.filter(([, , rule]) => rule.rule === "requiredWhen").map(
      ([, profile, rule]) => `${profile.name}:${(rule as { claim: string }).claim}`,
    );

    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(REQUIRED_WHEN_VIOLATIONS).sort()).toEqual(
      [...new Set(keys)].sort(),
    );
  });

  test("should declare a shape violation for exactly the shape rules that exist", () => {
    expect(Object.keys(SHAPE_VIOLATIONS).sort()).toEqual(Object.keys(SHAPE_RULES).sort());
  });

  // A violation must SAY why it violates. The note is what a reader of a failing
  // row has instead of reverse-engineering the input.
  test("should state a reason on every declared violation", () => {
    const declared = [
      ...Object.values(MATCH_VIOLATIONS),
      ...Object.values(SHAPE_VIOLATIONS),
      ...Object.values(REQUIRED_WHEN_VIOLATIONS),
    ];

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((violation) => !violation.note.trim())).toEqual([]);
  });

  // ⚠ THE POLICY MATRIX. Every rule instance × every direction it declares, run
  // by DIFFERENCE: the enforcer on the profile's own baseline, then on the
  // violation, and the violation must report a failure the baseline did not. A
  // rule the enforcer does not run in one of the directions it declares reports
  // nothing new in that direction and fails here — which is exactly the shape
  // `atLeastOneOf` had, declared for both directions and enforced on one.
  test.each(EXERCISES)("%s", (_label, profile, rule, violation, drop, direction) => {
    const added = runPolicyExercise({ direction, profile, rule, violation, drop });

    expect(
      added,
      `the rule is declared for "${direction}" but violating it changed nothing the enforcer reported there — ${violation.note}`,
    ).not.toEqual([]);
  });

  // ⚠ THE VIOLATION TABLES ARE PURE DATA, and their own header says so. Nothing
  // enforced it, and the three of them DO carry live `Date`s — the domain shape
  // of a NumericDate claim is one — so the statement has to permit exactly that
  // and nothing else. A lambda or a closure slipped into a violation would make
  // the table unreadable by anything that is not TypeScript, which is the
  // property every table in `__fixtures__` is written to keep.
  test("should hold nothing a JSON reader could not follow", () => {
    const offenders: Array<string> = [];

    const walk = (path: string, value: unknown): void => {
      if (value === null || isDateSample(value)) return;

      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(`${path}[${index}]`, entry));
        return;
      }

      if (typeof value === "object") {
        for (const [key, entry] of Object.entries(value as Dict)) {
          walk(`${path}.${key}`, entry);
        }
        return;
      }

      if (["string", "number", "boolean", "undefined"].includes(typeof value)) return;

      offenders.push(`${path} is a ${typeof value}`);
    };

    const tables: Array<[string, ReadonlyArray<Violation>]> = [
      ["MATCH_VIOLATIONS", Object.values(MATCH_VIOLATIONS)],
      ["REQUIRED_WHEN_VIOLATIONS", Object.values(REQUIRED_WHEN_VIOLATIONS)],
      ["SHAPE_VIOLATIONS", Object.values(SHAPE_VIOLATIONS)],
    ];

    for (const [label, violations] of tables) {
      expect(violations.length).toBeGreaterThan(0);
      violations.forEach((violation, index) => walk(`${label}[${index}]`, violation));
    }

    expect(offenders).toEqual([]);
  });

  // ⚠ EVERY `file:line` A TABLE CITES MUST RESOLVE. The per-table checks match
  // the SHAPE of a site (`src/….ts:N`) and never the TARGET, so a citation goes
  // on compiling and on reading correctly while the code beneath it moves — and
  // the drift is silent, because nothing dereferences it. One defect was spelled
  // at two different lines of the same file for exactly that reason.
  //
  // Read from the FIXTURE SOURCES as text rather than from the tables as data,
  // because most citations live in PROSE — a `knownDefect` reason, an
  // `unobservable` sentence — where no field holds them.
  //
  // It cannot check that the line still says what the note claims; what it can
  // check is that the file exists and is long enough, which is the failure mode
  // a moved or deleted target actually produces.
  describe("every cited source site", () => {
    const ROOT = new URL("../../", import.meta.url);

    const CITATIONS = [
      "src/__fixtures__/scenarios.ts",
      "src/__fixtures__/knob-probes.ts",
      "src/__fixtures__/spec-dispositions.ts",
      "src/__fixtures__/coverage-census.ts",
      "src/__fixtures__/policy-exercises.ts",
    ].flatMap((file) =>
      [
        ...readFileSync(new URL(file, ROOT), "utf8").matchAll(/src\/[\w./-]+\.ts:(\d+)/g),
      ].map((match): [string, string, number] => [
        `${file} cites ${match[0]}`,
        match[0].slice(0, match[0].lastIndexOf(":")),
        Number(match[1]),
      ]),
    );

    test("should be cited at all", () => {
      expect(CITATIONS.length).toBeGreaterThan(0);
    });

    test.each(CITATIONS)("%s", (_label, file, line) => {
      const lines = readFileSync(new URL(file, ROOT), "utf8").split("\n").length;

      expect(line).toBeGreaterThan(0);
      expect(
        line,
        `${file} has ${lines} lines, so the cited line does not exist`,
      ).toBeLessThanOrEqual(lines);
    });
  });
});
