import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createScenarioContext,
  DEFAULT_CLOCK,
  type ScenarioContext,
} from "../__fixtures__/run-scenario.js";
import {
  dispositionOn,
  runSpecDisposition,
  specLabel,
  specWiresOf,
  SPEC_DISPOSITION_DEFECT_TAGS,
} from "../__fixtures__/run-spec-disposition.js";
import type { Wire } from "../__fixtures__/scenarios.js";
import {
  CLAIM_DISPOSITIONS,
  HEADER_DISPOSITIONS,
  type SpecDisposition,
} from "../__fixtures__/spec-dispositions.js";
import { CLAIM_SPECS, joseName } from "../internal/claims/claims-registry.js";
import { HEADER_SPECS, headerJoseName } from "../internal/header/header-registry.js";
import { WIRE_TAGS } from "../internal/registry/wire.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The PER-SPEC MATRIX — the third generated matrix of the conformance suite, and
 * the consumer `ParamSpec.sample` was written for and never had.
 *
 * `sample` is REQUIRED on all 99 registry entries. Its own docstring says why:
 * "so a new parameter cannot be added without giving the generated conformance
 * suite something to round-trip — which is what stops a new parameter from
 * dodging coverage entirely." Nothing read it. The column enforced the writing of
 * a value and nothing else, and two of the values it enforced were unusable — a
 * `namingSystem` that is not a member of its own union, and a NumericDate two
 * years ahead of any clock that could verify it — which is exactly what a
 * required-but-unread column produces.
 *
 * Every entry now states a DISPOSITION and the matrix runs it: a `roundTrip`
 * through a named public door, a `refused` that must throw, or a `notSuppliable`
 * with the reason there is no caller door and what is observed instead.
 *
 * ⚠ THE ANTI-DRIFT BINDING is the first two tests. The disposition tables and the
 * registries are INDEPENDENTLY AUTHORED, and their key sets are compared at
 * RUNTIME — never a table against a re-derivation of itself. That comparison is
 * the whole reason `sample` is mandatory: without it a new registry entry simply
 * would not appear in this file and would run nowhere.
 */

type SpecRow = [
  domain: string,
  disposition: SpecDisposition,
  sample: unknown,
  wireKey: string,
];

const claimRows: ReadonlyArray<SpecRow> = CLAIM_SPECS.filter(
  (spec) => CLAIM_DISPOSITIONS[spec.domain] !== undefined,
).map((spec) => [
  spec.domain,
  CLAIM_DISPOSITIONS[spec.domain],
  spec.sample,
  joseName(spec),
]);

const headerRows: ReadonlyArray<SpecRow> = HEADER_SPECS.filter(
  (spec) => HEADER_DISPOSITIONS[spec.domain] !== undefined,
).map((spec) => [
  spec.domain,
  HEADER_DISPOSITIONS[spec.domain],
  spec.sample,
  headerJoseName(spec),
]);

const ROWS: ReadonlyArray<SpecRow> = [...claimRows, ...headerRows];

/** The generated matrix: every registry entry × every wire its disposition runs on. */
const MATRIX: ReadonlyArray<[string, string, SpecDisposition, unknown, string, Wire]> =
  ROWS.flatMap(([domain, disposition, sample, wireKey]) =>
    specWiresOf(disposition).map(
      (wire): [string, string, SpecDisposition, unknown, string, Wire] => [
        specLabel(domain, disposition, wire),
        domain,
        disposition,
        sample,
        wireKey,
        wire,
      ],
    ),
  );

describe("Aegis — per-spec matrix", () => {
  let ctx: ScenarioContext;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createScenarioContext();
  });

  // ⚠ THE BINDING. Two independently authored artifacts, compared key set to key
  // set — the registry's own `domain` column against the table this file drives.
  // A new claim with no disposition fails here; a disposition for a claim nobody
  // registers fails here too. Never the table against a re-derivation of itself,
  // which is the shape that has been dead twice in this package already.
  test("should state a disposition for exactly the registered claims", () => {
    expect(CLAIM_SPECS.length).toBeGreaterThan(0);
    expect(Object.keys(CLAIM_DISPOSITIONS).sort()).toEqual(
      CLAIM_SPECS.map((spec) => spec.domain).sort(),
    );
  });

  test("should state a disposition for exactly the registered header parameters", () => {
    expect(HEADER_SPECS.length).toBeGreaterThan(0);
    expect(Object.keys(HEADER_DISPOSITIONS).sort()).toEqual(
      HEADER_SPECS.map((spec) => spec.domain).sort(),
    );
  });

  // A `roundTrip` names the door it goes through — "how does a caller set this?"
  // with an executed answer. A `refused` names the door that must refuse. Only a
  // `notSuppliable` may name none, because there is none.
  test("should name a door on every suppliable disposition", () => {
    const doorless = ROWS.flatMap(([domain, disposition]) =>
      WIRE_TAGS.map((wire) => [domain, wire, dispositionOn(disposition, wire)] as const)
        .filter(
          ([, , resolved]) =>
            resolved.disposition !== "notSuppliable" && resolved.door === undefined,
        )
        .map(([name, wire]) => `${name} [${wire}]`),
    );

    expect(ROWS.length).toBeGreaterThan(0);
    expect(doorless).toEqual([]);
  });

  // ⚠ `refused` and `notSuppliable` ARE THE TWO ESCAPE HATCHES, so both are held
  // to a stated reason. A refusal is a claim about a SPECIFICATION — the wire has
  // no representation for the parameter — and a `notSuppliable` is a claim about
  // the surface. Neither can be reached by silence.
  test("should state a reason on every refused and notSuppliable disposition", () => {
    const unexplained = ROWS.flatMap(([domain, disposition]) =>
      WIRE_TAGS.map((wire) => [domain, wire, dispositionOn(disposition, wire)] as const)
        .filter(([, , resolved]) => resolved.disposition !== "roundTrip")
        .filter(([, , resolved]) => (resolved.reason ?? "").trim().length === 0)
        .map(([name, wire]) => `${name} [${wire}]`),
    );

    expect(ROWS.length).toBeGreaterThan(0);
    expect(unexplained).toEqual([]);
  });

  // A `notSuppliable` that observes NOTHING asserts nothing, which is the one
  // silence this suite permits — and only because the alternative is an entry
  // pretending to observe a parameter no fixture can produce. It must therefore
  // say so by name rather than by omitting the field.
  test("should declare an observation on every notSuppliable disposition", () => {
    const unstated = ROWS.flatMap(([domain, disposition]) =>
      WIRE_TAGS.map((wire) => [domain, wire, dispositionOn(disposition, wire)] as const)
        .filter(([, , resolved]) => resolved.disposition === "notSuppliable")
        .filter(([, , resolved]) => resolved.observe === undefined)
        .map(([name, wire]) => `${name} [${wire}]`),
    );

    expect(ROWS.length).toBeGreaterThan(0);
    expect(unstated).toEqual([]);
  });

  // `defect` is the TRANSIENT declaration — the parameter IS suppliable and does
  // NOT come back, which is a code shortfall and never a disposition. It says
  // where, as `src/path.ts#<verbatim substring of the cited line>`, or it is a
  // complaint. The meta suite RESOLVES the anchor; this only checks the shape.
  test("should name a repairable site in every declared defect", () => {
    const defects = ROWS.filter(([, disposition]) => disposition.defect !== undefined);

    expect(defects.length).toBeGreaterThan(0);
    expect(
      defects
        .filter(([, d]) => !/^src\/.+\.ts#.+$/.test(d.defect?.site ?? ""))
        .map(([domain]) => domain),
    ).toEqual([]);
    expect(defects.filter(([, d]) => !d.defect?.note.trim())).toEqual([]);
  });

  // ⚠ THE DEFECT LIST IS SELF-VERIFYING. A `defect` SKIPS its wires in the matrix
  // below, so an unchecked one is a way to turn a red cell green by writing a
  // sentence. Every declared defect is RUN on the wire it names and must still
  // FAIL — and it is what DELETES the entry: repair the code and this goes red
  // until the declaration is removed and the cell rejoins the matrix.
  //
  // ⚠ AND THE FAILURE HAS TO BE THE RIGHT FAILURE. This asserted only that the
  // cell did not round-trip, which ANY thrown message satisfies — including the
  // interpreter's own `HARNESS_BROKEN` throws, one of which sits directly above
  // the door call. A dead entry would then keep its wire skipped forever with
  // nothing behind the skip, so the interpreter tags each reason and this reads
  // the tag (see `SPEC_DISPOSITION_FAILURE`). Two of the four tags name a
  // shortfall; the other two name the entry or the sample being broken, and both
  // fail in the same direction as a shortfall does.
  test.each(
    ROWS.flatMap(([domain, disposition, sample, wireKey]) =>
      (disposition.defect?.wires ?? []).map(
        (wire): [string, string, SpecDisposition, unknown, string, Wire] => [
          `${domain} [${wire}] still manifests`,
          domain,
          disposition,
          sample,
          wireKey,
          wire,
        ],
      ),
    ),
  )("%s", async (_label, domain, disposition, sample, wireKey, wire) => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    const outcome = await runSpecDisposition({
      ctx: await createScenarioContext(),
      disposition,
      domain,
      sample,
      wireKey,
      wire,
    }).then(
      () => "the parameter DOES round-trip",
      (error: unknown) => (error as Error).message,
    );

    expect(outcome).not.toBe("the parameter DOES round-trip");

    // The tag is the first token of the message, and the two that count are the
    // ones meaning the parameter was suppliable and did not survive.
    expect(
      SPEC_DISPOSITION_DEFECT_TAGS.some((tag) => outcome.startsWith(tag)),
      `the declared defect no longer fails for the reason it names — the cell failed with: ${outcome}`,
    ).toBe(true);
  });

  // Every claim sample must be USABLE, and a NumericDate sample is usable only
  // relative to the clock a token is verified at. `temporal: "past"` must not be
  // in the future and `temporal: "future"` must not be in the past, so ONE
  // instant cannot serve both marks — which is what the registry had, two years
  // ahead of any plausible verification, refusing every `iat` sample on sight.
  test("should keep every past-temporal sample behind every future-temporal one", () => {
    const at = (temporal: "past" | "future"): ReadonlyArray<number> =>
      CLAIM_SPECS.filter((spec) => spec.temporal === temporal).map((spec) =>
        (spec.sample as Date).getTime(),
      );

    const past = at("past");
    const future = at("future");

    expect(past.length).toBeGreaterThan(0);
    expect(future.length).toBeGreaterThan(0);
    expect(Math.max(...past)).toBeLessThan(Math.min(...future));

    // …and the conformance clock sits BETWEEN them, so a token built from the
    // samples is one a verifier accepts rather than one it refuses on arrival.
    const clock = new Date(DEFAULT_CLOCK).getTime();

    expect(Math.max(...past)).toBeLessThan(clock);
    expect(Math.min(...future)).toBeGreaterThan(clock);
  });

  // THE MATRIX. Every registry entry, on every wire its disposition runs on.
  test.each(MATRIX)("%s", async (_label, domain, disposition, sample, wireKey, wire) => {
    await runSpecDisposition({ ctx, disposition, domain, sample, wireKey, wire });
  });
});
