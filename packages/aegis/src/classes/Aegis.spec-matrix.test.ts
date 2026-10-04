import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  dispositionOn,
  runSpecDisposition,
  specLabel,
} from "../__fixtures__/run-spec-disposition.js";
import {
  CLAIM_DISPOSITIONS,
  HEADER_DISPOSITIONS,
  type SpecDisposition,
} from "../__fixtures__/spec-dispositions.js";
import {
  createTestDeployment,
  DEFAULT_CLOCK,
  type TestDeployment,
} from "../__fixtures__/test-deployment.js";
import { CLAIM_SPECS, joseName } from "../internal/claims/claims-registry.js";
import { HEADER_SPECS, headerJoseName } from "../internal/header/header-registry.js";
import { WIRE_TAGS, type Wire } from "../internal/registry/wire.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The PER-SPEC MATRIX — a generated matrix over the claim and header registries,
 * and the consumer `ParamSpec.sample` was written for and never had.
 *
 * `sample` is REQUIRED on all 98 registry entries (pinned:
 * `classes/Aegis.spec-matrix.test.ts#should keep the documented registry
 * totals true`). Its own docstring says why: "so a new parameter cannot be
 * added without giving the generated conformance suite something to
 * round-trip — which is what stops a new parameter from dodging coverage
 * entirely." Nothing read it. The column enforced the writing of a value and
 * nothing else, and two of the values it enforced were unusable — a
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

/** The generated matrix: every registry entry × every wire. */
const MATRIX: ReadonlyArray<[string, string, SpecDisposition, unknown, string, Wire]> =
  ROWS.flatMap(([domain, disposition, sample, wireKey]) =>
    WIRE_TAGS.map((wire): [string, string, SpecDisposition, unknown, string, Wire] => [
      specLabel(domain, disposition, wire),
      domain,
      disposition,
      sample,
      wireKey,
      wire,
    ]),
  );

describe("Aegis — per-spec matrix", () => {
  let ctx: TestDeployment;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createTestDeployment();
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

  // The two hand-maintained totals in `spec-dispositions.ts` — "98 registry
  // entries" and "SIX of the twenty" — name this test as their binding, so a
  // 21st header row reddens here rather than leaving stale prose standing.
  // `mint.header` is the generic header-options-bag door (as opposed to a
  // dedicated option like `mint.typ` or `encrypt.party`), so filtering on it
  // is exactly "caller-settable through the domain header bag".
  test("should keep the documented registry totals true", () => {
    expect(CLAIM_SPECS.length + HEADER_SPECS.length).toBe(98);

    const domainHeaderBagParams = Object.values(HEADER_DISPOSITIONS).filter(
      (disposition) => disposition.door === "mint.header",
    );

    expect(domainHeaderBagParams.length).toBe(6);
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

  // Every claim sample must be USABLE, and a NumericDate sample is usable only
  // relative to the clock a token is verified at. `temporal: "past"` must not be
  // in the future and `temporal: "future"` must be in the future, so ONE instant
  // cannot serve both marks.
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

  // THE MATRIX. Every registry entry, on every wire.
  test.each(MATRIX)("%s", async (_label, domain, disposition, sample, wireKey, wire) => {
    await runSpecDisposition({ ctx, disposition, domain, sample, wireKey, wire });
  });
});
