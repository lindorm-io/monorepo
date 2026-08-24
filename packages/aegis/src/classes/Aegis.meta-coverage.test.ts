import { existsSync, readdirSync, readFileSync } from "node:fs";
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
 * ⚠ The direction fan-out is what makes the matrix mean what its name says.
 * Taking only the FIRST direction a rule lists would run the mint path alone —
 * every rule lists `"mint"` first — so the enforcer could skip
 * `direction === "verify"` outright with the whole matrix green. That is the same
 * shortfall as the one this suite exists for, one level up: a rule enforced on
 * the issuing half and not on the receiving half is exactly what a relying party
 * cannot see.
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

  // The census cells, bound to the real table rather than to the type alone. The
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

    // ⚠ `observed` owes its note exactly as `declared` owes its reason. It did
    // not, so `{ exercised: "observed", note: "" }` passed while the `declared`
    // twin failed — and an `observed` cell is the one kind that claims a test
    // watches the behaviour without any production reader to point at, which is
    // precisely when the prose IS the whole justification.
    const unjustified = entries.filter(
      (entry) =>
        (entry.exercised === "declared" && !entry.reason.trim()) ||
        (entry.exercised === "observed" && !entry.note.trim()),
    );
    const unsited = entries.filter(
      (entry) => entry.exercised === "reader" && !/^src\/.+\.ts#.+$/.test(entry.site),
    );

    // ⚠ THE PATH MUST EXIST. The shape check above says a citation LOOKS like
    // `src/…ts#anchor`; it cannot say the file is there, and a well-formed
    // citation pointing at the wrong file is exactly the failure this census
    // suffered — an `observed` note credited a test file that had never
    // imported the function it described. The anchor resolution below covers
    // every citation written INSIDE a fixture; this covers `reader.site`, which
    // is a bare field and not scanned as prose.
    const packageRoot = new URL("../../", import.meta.url);

    const missing = entries
      .filter((entry) => entry.exercised === "reader")
      .map((entry) => entry.site.split("#")[0])
      .filter((file) => !existsSync(new URL(file, packageRoot)));

    expect(entries.length).toBeGreaterThan(0);
    expect(unjustified).toEqual([]);
    expect(unsited).toEqual([]);
    expect(missing, "a cited source file does not exist").toEqual([]);
  });

  // The measurement the census exists to make VISIBLE: nine capability cells
  // have a production reader. The table's premise is that a kit
  // reads its own row, and for most of it that is not yet true. Pinned so the
  // number moves in review — up when a kit starts reading its row, and never
  // silently down.
  //
  // ⚠ The three JOSE kits read their own `reserved` row through `buildJoseHeader`,
  // the way the COSE kits read theirs through `buildCoseHeaders`.
  //
  // ⚠ `cwt.cnfMembers` has no reader, and the reason is on the record: the COSE
  // confirmation has ONE source, the row being DERIVED from the label table the
  // codec switches over (`claims/cnf-members.ts`, where the label table is in
  // turn derived from each member's own `wire.cose` cell). Nothing reads it back
  // because there is nothing left to disagree with — the row and the encoder are
  // the same data. A read of a second list is weaker than not having one.
  test("should record how many capability cells a kit actually reads", () => {
    const cells = Object.values(KIT_CELL_CENSUS).flatMap((row) => Object.values(row));

    expect(cells.length).toBe(35);
    expect(cells.filter((cell) => cell.exercised === "reader").length).toBe(9);
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

  // ⚠ EVERY SITE A TABLE CITES MUST RESOLVE — and a citation NAMES ITS TARGET
  // rather than pointing at a line number, because a line number cannot be
  // dereferenced. A previous version of this block checked that the cited line
  // was IN RANGE, which code motion leaves true while moving the target out from
  // under it: one refactor broke six of twenty-one citations and this caught the
  // three whose file happened to shrink past the number.
  //
  // The grammar is `src/path.ts#<anchor>`, where the anchor is a VERBATIM
  // substring of the cited line. It must match EXACTLY ONE line — an ambiguous
  // anchor is as broken as an absent one, and the count catches both directions.
  // The resolved line number goes in the failure message, computed rather than
  // stored, so a reader still gets somewhere to look.
  //
  // Read from the FIXTURE SOURCES as text rather than from the tables as data,
  // because most citations live in PROSE — a `knownDefect` reason, an
  // `unobservable` sentence — where no field holds them. Every `.ts` under
  // `__fixtures__` is scanned, DERIVED not hand-listed, so a new fixture cannot
  // opt out of the check by being new (one already had).
  describe("every cited source site", () => {
    const ROOT = new URL("../../", import.meta.url);
    const FIXTURES = "src/__fixtures__/";

    // A citation is DELIMITED: the same quote or backtick opens and closes it, so
    // an anchor may hold any character but that delimiter. Anchors carry neither
    // quote, so either string style can spell one.
    const CITATION = /(["'`])(src\/[\w./-]+\.ts)#([^\n]*?)\1/g;
    const SOURCE_PATH = /src\/[\w./-]+\.ts/g;
    const LINE_NUMBER = /[\w./-]+\.ts:\d+/g;
    // A source file named WITHOUT the `src/` prefix and WITHOUT a `:N` suffix —
    // `cwt-token.ts`, `internal/header/cose-wire-header.ts` — which is neither a
    // `SOURCE_PATH` nor a `LINE_NUMBER` and so escaped both. Not hypothetical:
    // three sat in the tables, one naming a predicate (`contents.length < 3`)
    // that had not existed in the file it named for two refactors. A citation
    // the scanner cannot see is exactly what this instrument exists to end.
    const BARE_PATH = /(?<![\w./-])(?:[\w-]+\/)*[\w-]+\.ts(?![\w:])/g;

    // ⚠ RECURSIVE. A non-recursive read let a future `__fixtures__/` subdirectory
    // opt out of the very check whose own note says a new fixture cannot.
    const SOURCES = readdirSync(new URL(FIXTURES, ROOT), {
      encoding: "utf8",
      recursive: true,
    })
      .filter((name) => name.endsWith(".ts"))
      .map((name): [string, string] => [
        `${FIXTURES}${name}`,
        readFileSync(new URL(`${FIXTURES}${name}`, ROOT), "utf8"),
      ]);

    // A bare name is NAVIGATIONAL when it names a SIBLING FIXTURE — the row
    // interpreter, the key bag, the corpus runner. Those point a reader at the
    // machinery beside the tables, not at a production site a verdict rests on;
    // nothing dereferences them, so they need no anchor. The exemption is DERIVED
    // from the directory for the same reason `SOURCES` is — a hand list rots the
    // moment a fixture is added or renamed — and is paired with the collision
    // check below, without which it could quietly cover a production path that
    // happened to share a basename.
    const NAVIGATIONAL = new Set(
      SOURCES.map(([fixture]) => fixture.slice(fixture.lastIndexOf("/") + 1)),
    );

    const CITATIONS = SOURCES.flatMap(([fixture, text]) =>
      [...text.matchAll(CITATION)].map((match): [string, string, string] => [
        `${fixture} cites ${match[2]}#${match[3]}`,
        match[2],
        match[3],
      ]),
    );

    test("should be cited at all", () => {
      expect(CITATIONS.length).toBeGreaterThan(0);
    });

    // The exemption above is only safe while a fixture basename names nothing in
    // production. The moment one did, every bare mention of that name would be
    // waved through — including a stale citation to the production file.
    test("no fixture basename shadows a production source file", () => {
      const production = readdirSync(new URL("src/", ROOT), {
        encoding: "utf8",
        recursive: true,
      })
        .filter((name) => name.endsWith(".ts") && !name.startsWith("__fixtures__"))
        .map((name) => name.slice(name.lastIndexOf("/") + 1));

      expect([...NAVIGATIONAL].filter((name) => production.includes(name))).toEqual([]);
    });

    // The three ways a citation could still escape the check: written without its
    // delimiters, so the pattern above never sees it — written as a line number,
    // which is the grammar this replaced and which nothing can resolve — or
    // written BARE, with neither the `src/` prefix nor a `:N`, which is invisible
    // to both of the first two. A line number spelled without the `src/` prefix
    // escaped the first two: three sat in a section comment naming the very sites
    // the rows beneath it cite. Three bare names then survived all three checks.
    test.each(SOURCES)("%s cites by anchor, never by line number", (_fixture, text) => {
      const cited = [...text.matchAll(CITATION)].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
      }));

      const outsideCitation = (index: number): boolean =>
        !cited.some((c) => index >= c.start && index < c.end);

      const uncited = [...text.matchAll(SOURCE_PATH)]
        .filter((match) => outsideCitation(match.index))
        .map((match) => `${match[0]} at index ${match.index}`);

      const numbered = [...text.matchAll(LINE_NUMBER)].map((match) => match[0]);

      const bare = [...text.matchAll(BARE_PATH)]
        .filter((match) => !match[0].startsWith("src/"))
        .filter(
          (match) => !NAVIGATIONAL.has(match[0].slice(match[0].lastIndexOf("/") + 1)),
        )
        .filter((match) => outsideCitation(match.index))
        .map((match) => `${match[0]} at index ${match.index}`);

      expect(uncited, "a source path must be cited as `src/path.ts#anchor`").toEqual([]);
      expect(numbered, "a citation names its target, never a line number").toEqual([]);
      expect(
        bare,
        "a bare `<name>.ts` is invisible to the scanner — cite it as `src/path.ts#anchor`",
      ).toEqual([]);
    });

    test.each(CITATIONS)("%s", (_label, file, anchor) => {
      expect(anchor, "an anchor must be a verbatim source substring").toBe(anchor.trim());
      expect(
        anchor,
        "an anchor carries no quote — either string style spells one",
      ).not.toMatch(/["']/);

      const source = readFileSync(new URL(file, ROOT), "utf8").split("\n");
      const hits = source.flatMap((line, index) =>
        line.includes(anchor) ? [index + 1] : [],
      );

      expect(
        hits,
        hits.length === 0
          ? `${file} no longer contains \`${anchor}\``
          : `${file} contains \`${anchor}\` at lines ${hits.join(", ")} — an ambiguous citation`,
      ).toHaveLength(1);
    });
  });
});
