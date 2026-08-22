import type { Dict } from "@lindorm/types";
import { importJWK } from "jose";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisKeyError } from "../errors/index.js";
import type {
  JoseSignStructuredTokenOptions,
  JoseSignUnstructuredTokenOptions,
  JweEncryptOptions,
  ProfileContent,
} from "../types/index.js";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "./keys.js";
import {
  artifactStepOf,
  createScenarioContext,
  DEFAULT_CLOCK,
  readWirePayload,
  runScenario,
  selfMarkedWireOf,
  signCompactByHand,
  wiresOf,
  pinnedWireOf,
  type ScenarioContext,
} from "./run-scenario.js";
import {
  CLIENT,
  ISSUER,
  NOW,
  RESOURCE,
  type CwtSignOptions,
  type ForgedMember,
  type Given,
  type OpaqueSignOptions,
  type Scenario,
  type SealedSealOptions,
  type StructuredSignOptions,
  type Wire,
} from "./scenarios.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The INTERPRETER's own tests.
 *
 * `run-scenario.ts` is the step-definition layer, and the conformance table
 * leans on its guards as SAFETY properties: rows are written on the promise that
 * an unreadable payload fails a `wirePayload` assertion instead of satisfying it
 * vacuously, that a row's wire coverage is derived from its artifact rather than declared, and that a
 * mis-shaped row is refused rather than half-run. A guard nothing exercises is a
 * promise nobody has read, so the step-definition layer meets the same bar the
 * rows do.
 */
describe("run-scenario — the step-definition layer", () => {
  let ctx: ScenarioContext;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createScenarioContext();
    ctx.amphora.add(TEST_EC_KEY_ENC);
    ctx.amphora.add(TEST_OCT_KEY_ENC);
  });

  describe("readWirePayload", () => {
    // The positive case first: without it, every assertion below would also be
    // satisfied by a reader that called everything unreadable.
    test("should read the cleartext payload of a JWT", async () => {
      const { token, format } = await ctx.aegis.jwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        jti: "token-1",
      });

      expect(readWirePayload(token, format)).toMatchObject({
        readable: true,
        payload: { sub: "user-1", jti: "token-1" },
      });
    });

    // A COSE payload comes back COSE-name-keyed — `cti`, not `jti`.
    test("should read the cleartext payload of a CWT, under its COSE names", async () => {
      const { token, format } = await ctx.aegis.cwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        cti: "token-1",
      });

      expect(readWirePayload(token, format)).toMatchObject({
        readable: true,
        payload: { sub: "user-1", cti: "token-1" },
      });
    });

    test("should refuse a JWE — its payload is ciphertext", async () => {
      const { token, format } = await ctx.aegis.jwe.encrypt({ hello: "world" });

      expect(format).toBe("jwe");
      expect(readWirePayload(token, format)).toMatchObject({ readable: false });
    });

    // ⚠ THE reason the format is passed in. A CWE is a COSE_Encrypt0 — a
    // three-element array — so it satisfies `decodeCwtWire`'s arity check and its
    // CIPHERTEXT reaches the CBOR decoder. Shape alone cannot tell it apart from a
    // CWT, so the refusal has to come from the DECLARED format, before the bytes
    // are touched.
    test("should refuse a CWE on its declared format, not on its shape", async () => {
      const { token, format } = await ctx.aegis.cwe.encrypt("hello cose");

      expect(format).toBe("cwe");
      expect(readWirePayload(token, format)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("ciphertext"),
      });
    });

    // A 3-part JOSE token is not necessarily a JWT: an opaque JWS carries bytes,
    // not JSON. The harness names that itself rather than letting a raw
    // SyntaxError surface from three frames down.
    test("should refuse an opaque JWS whose payload is not JSON", async () => {
      const { token, format } = await ctx.aegis.jws.sign(Buffer.from("opaque payload"));

      expect(readWirePayload(token, format)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("opaque body"),
      });
    });

    test("should refuse a JOSE token that has the wrong number of parts", () => {
      expect(readWirePayload("aaa.bbb.ccc.ddd.eee", "jwt")).toMatchObject({
        readable: false,
        reason: expect.stringContaining("5-part"),
      });
    });

    test("should refuse an empty token", () => {
      expect(readWirePayload("", undefined)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("COSE structure"),
      });
    });

    // An unknown format must not be read as "not encrypted, therefore readable" —
    // the shape check still runs behind it.
    test("should still refuse an unreadable token when no format is declared", () => {
      expect(readWirePayload("not-a-token", undefined)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("COSE structure"),
      });
    });
  });

  describe("wiresOf", () => {
    const probe = (given: Given, unsupported?: Scenario["unsupported"]): Scenario => ({
      id: "probe",
      title: "a probe row, for the wire derivation alone",
      rationale: "not a capability — this row exists only to exercise `wiresOf`.",
      given,
      when: [{ step: "parse" }],
      then: [{ step: "accepts" }],
      ...(unsupported ? { unsupported } : {}),
    });

    const MINT_CONTENT = {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: CLIENT,
    } satisfies ProfileContent["access_token"];

    // COVERAGE IS THE DEFAULT. Every case below that runs on both wires reaches
    // the second one without a hand-written twin.
    test("should run a claim-only row on every wire — the static surface has no wire", () => {
      const scenario = probe([{ step: "claims", claims: { subject: "user-1" } }]);

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
    });

    test.each([["structured" as const], ["opaque" as const]])(
      "should run a %s kit-sign row on every wire",
      (kit) => {
        const scenario = probe([
          { step: "token", via: "kit-sign", kit, claims: { a: 1 } },
        ]);

        expect(pinnedWireOf(scenario)).toBeUndefined();
        expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
      },
    );

    test("should run a sealed kit-encrypt row on every wire", () => {
      const scenario = probe([
        { step: "token", via: "kit-encrypt", kit: "sealed", data: { a: 1 } },
      ]);

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
    });

    test("should run a mint row with no requested format on every wire", () => {
      const scenario = probe([
        { step: "token", via: "mint", profile: "access_token", content: MINT_CONTENT },
      ]);

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
    });

    test("should run a domain-sign row on every wire", () => {
      const scenario = probe([
        { step: "token", via: "domain-sign", claims: { subject: "user-1" } },
      ]);

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
    });

    test("should run a domain-encrypt row with no requested format on every wire", () => {
      const scenario = probe([{ step: "token", via: "domain-encrypt", data: { a: 1 } }]);

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose", "cose"]);
    });

    // A row MAY still pin itself — some capabilities genuinely are one-wire. It
    // then owes the other wire a reason, which the conformance table's coverage
    // test collects.
    test.each([
      ["jwt" as const, "jose" as const],
      ["jws" as const, "jose" as const],
      ["cwt" as const, "cose" as const],
      ["cws" as const, "cose" as const],
    ])("should pin a %s kit-sign row to %s", (kit, wire) => {
      const scenario = probe([{ step: "token", via: "kit-sign", kit, claims: { a: 1 } }]);

      expect(pinnedWireOf(scenario)).toBe(wire);
      expect(wiresOf(scenario)).toEqual([wire]);
    });

    test.each([
      ["jwe" as const, "jose" as const],
      ["cwe" as const, "cose" as const],
    ])("should pin a %s kit-encrypt row to %s", (kit, wire) => {
      const scenario = probe([
        { step: "token", via: "kit-encrypt", kit, data: { a: 1 } },
      ]);

      expect(pinnedWireOf(scenario)).toBe(wire);
      expect(wiresOf(scenario)).toEqual([wire]);
    });

    test("should pin a mint row that requests a format", () => {
      const scenario = probe([
        {
          step: "token",
          via: "mint",
          profile: "access_token",
          content: MINT_CONTENT,
          options: { format: "cwt" },
        },
      ]);

      expect(pinnedWireOf(scenario)).toBe("cose");
      expect(wiresOf(scenario)).toEqual(["cose"]);
    });

    // A FORGED row names an encoding and nothing else, so its own `wire` cell is
    // the only pin — and a row declaring `unsupported: { jose }` has that wire
    // filtered out of `wiresOf` anyway, so no scenario run witnesses the cell.
    // Dropping it from `artifactWireOf` reddens this test and nothing else.
    test("should pin a forged COSE member-table row to cose", () => {
      const scenario = probe([
        {
          step: "token",
          via: "forged",
          wire: "cose",
          claim: "act",
          carries: [{ key: "2", keyedBy: "label", value: "service-1" }],
          signature: "junk",
        },
      ]);

      expect(pinnedWireOf(scenario)).toBe("cose");
      expect(wiresOf(scenario)).toEqual(["cose"]);
    });

    test.each([
      ["cwe" as const, "cose" as const],
      ["jwe" as const, "jose" as const],
    ])("should pin a domain-encrypt row requesting %s to %s", (format, wire) => {
      const scenario = probe([
        { step: "token", via: "domain-encrypt", data: { a: 1 }, options: { format } },
      ]);

      expect(pinnedWireOf(scenario)).toBe(wire);
      expect(wiresOf(scenario)).toEqual([wire]);
    });

    // `unsupported` is the ONLY way to run on fewer wires. Without this the
    // field would be documentation again — the state it was in when the twin it
    // described went unwritten.
    test("should subtract a declared unsupported wire from an agnostic row", () => {
      const scenario = probe(
        [{ step: "token", via: "kit-sign", kit: "structured", claims: { a: 1 } }],
        { cose: "a stated reason" },
      );

      expect(pinnedWireOf(scenario)).toBeUndefined();
      expect(wiresOf(scenario)).toEqual(["jose"]);
    });

    // The setup steps sit AHEAD of the artifact, and the wire comes from the
    // artifact — so a row that stocks the vault first must read the same.
    test("should read the wire off the artifact, not off a preceding setup step", () => {
      const scenario = probe([
        { step: "keys", keys: ["ec-enc"] },
        { step: "clock", at: DEFAULT_CLOCK },
        { step: "token", via: "kit-sign", kit: "cwt", claims: { sub: "user-1" } },
      ]);

      expect(pinnedWireOf(scenario)).toBe("cose");
      expect(wiresOf(scenario)).toEqual(["cose"]);
    });
  });

  // ⚠ THE NEGATIVE FIXTURE. The conformance table's self-marking test has been
  // DEAD TWICE — first filtered on a field a row never sets, then rewritten to ask
  // whether a wire in `wiresOf(scenario)` appeared in `unsupported`, which is the
  // exact negation of the filter that produced that array and so returned `[]` for
  // every table that could ever be written. The real table cannot show that the
  // replacement can fail, because no row in it violates the rule; only a row built
  // to violate it can. Both directions are stated here.
  describe("selfMarkedWireOf", () => {
    const probe = (given: Given, unsupported?: Scenario["unsupported"]): Scenario => ({
      id: "probe",
      title: "a probe row, for the self-marking predicate alone",
      rationale: "not a capability — this row exists only to exercise the predicate.",
      given,
      when: [{ step: "parse" }],
      then: [{ step: "accepts" }],
      ...(unsupported ? { unsupported } : {}),
    });

    test.each([
      ["cwt" as const, "cose" as const],
      ["jwt" as const, "jose" as const],
    ])(
      "should name the wire a %s row pins itself to and then declares unsupported",
      (kit, wire) => {
        const scenario = probe(
          [{ step: "token", via: "kit-sign", kit, claims: { a: 1 } }],
          { [wire]: "a reason that contradicts the row's own artifact" },
        );

        expect(selfMarkedWireOf(scenario)).toBe(wire);
      },
    );

    // The three legal shapes, so the predicate is not merely "always answers".
    test("should name nothing when a pinned row declares the OTHER wire unsupported", () => {
      const scenario = probe(
        [{ step: "token", via: "kit-sign", kit: "cwt", claims: {} }],
        {
          jose: "a stated reason",
        },
      );

      expect(selfMarkedWireOf(scenario)).toBeUndefined();
    });

    // An AGNOSTIC row declaring a wire unsupported is the declaration WORKING —
    // that is the only way such a row runs on fewer wires — so it must never be
    // reported. A predicate that read `wiresOf` could not tell the two apart.
    test("should name nothing when an agnostic row declares a wire unsupported", () => {
      const scenario = probe(
        [{ step: "token", via: "kit-sign", kit: "structured", claims: {} }],
        { cose: "a stated reason" },
      );

      expect(wiresOf(scenario)).toEqual(["jose"]);
      expect(selfMarkedWireOf(scenario)).toBeUndefined();
    });

    test("should name nothing when a row declares no unsupported wire at all", () => {
      const scenario = probe([
        { step: "token", via: "kit-sign", kit: "cwt", claims: {} },
      ]);

      expect(selfMarkedWireOf(scenario)).toBeUndefined();
    });
  });

  describe("artifactStepOf", () => {
    test("should return the LAST given step", () => {
      const artifact = { step: "claims", claims: { subject: "user-1" } } as const;

      expect(artifactStepOf([{ step: "keys", keys: ["ec-enc"] }, artifact])).toBe(
        artifact,
      );
    });

    // ⚠ LOCAL cast, deliberate: the `Given` tuple type makes this shape
    // unreachable at compile time, which is exactly why the RUNTIME guard behind
    // it is otherwise never executed. A guard that has never run is a guess.
    test("should refuse a given whose last step builds no artifact", () => {
      const given = [{ step: "keys", keys: ["ec-enc"] }] as unknown as Given;

      expect(() => artifactStepOf(given)).toThrow(/must build the artifact/);
    });
  });

  describe("runScenario", () => {
    // `static-assert` operates on a flat claim dict; handed a token it would
    // otherwise assert against `artifact.claims` of a step that has none.
    test("should refuse a static-assert act on a token-producing given", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the static-assert guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          { step: "token", via: "kit-sign", kit: "jws", claims: { hello: "world" } },
        ],
        when: [{ step: "static-assert", assert: { subject: "user-1" } }],
        then: [{ step: "accepts" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(
        /static-assert requires a \{ step: "claims" \} GIVEN/,
      );
    });

    // ⚠ The regression the interpreter was written around: a leading `mint` makes
    // the construction the FIRST act, not the only one. A verify that must refuse
    // proves the later act RAN — were it dropped, the row would assert the
    // successful mint and pass.
    test("should run every act after a leading mint", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the multi-act mint path alone",
        rationale: "not a capability — this row exists only to exercise the loop.",
        given: [
          {
            step: "token",
            via: "mint",
            profile: "access_token",
            content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
          },
        ],
        when: [
          { step: "mint" },
          {
            step: "verify",
            profile: "access_token",
            options: { audience: "someone-else" },
          },
        ],
        then: [{ step: "rejects", error: "AegisDomainError" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
    });

    // …and a single-act mint row still behaves exactly as before.
    test("should assert the construction itself when mint is the only act", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the single-act mint path alone",
        rationale: "not a capability — this row exists only to exercise the loop.",
        given: [
          {
            step: "token",
            via: "mint",
            profile: "access_token",
            content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
          },
        ],
        when: [{ step: "mint" }],
        then: [{ step: "accepts", format: "jwt" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
    });

    // ⚠ The other half of that split, and the reason it exists: unless the first
    // act is `mint`, the GIVEN's construction runs OUTSIDE the outcome try/catch,
    // so a SETUP that throws can never be mistaken for the rejection the row
    // expects. The probe is the strongest form of it — the construction throws
    // the EXACT class the row names, so nothing but the split can tell the two
    // apart. It must FAIL (the setup error escapes), not pass.
    test("should fail a rejecting row whose construction, not its act, threw", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the construction/act split alone",
        rationale: "not a capability — this row exists only to exercise the split.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "jwt",
            claims: {
              iss: ISSUER,
              sub: "user-1",
              aud: [RESOURCE],
              exp: NOW + 3600,
              iat: NOW,
              jti: "token-1",
            },
            // The vault holds no RS256 key, so the SIGN cannot resolve one and
            // the construction throws before any act runs.
            options: { key: { condition: { algorithm: "RS256" } } },
          },
        ],
        when: [{ step: "verify" }],
        then: [{ step: "rejects", error: "AegisKeyError" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(AegisKeyError);
    });

    // The CONSUMING half of `readWirePayload`'s unreadability signal: a row that
    // asserts on a payload the interpreter cannot read is FAILED rather than
    // satisfied. That is the promise the rows are written on — `excludes` over a
    // ciphertext payload can never fail, so an encryption row could otherwise
    // claim "the value never reached the wire" without ever looking at one.
    test("should fail a row that asserts on a wire payload it cannot read", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the unreadable-payload guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          { step: "token", via: "kit-encrypt", kit: "jwe", data: { hello: "world" } },
        ],
        when: [{ step: "decrypt" }],
        then: [
          { step: "accepts" },
          // Vacuously satisfied by an empty dict, which is precisely why the
          // interpreter must refuse to evaluate it.
          { step: "wirePayload", excludes: ["hello"] },
        ],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(
        /asserts on the cleartext wire payload/,
      );
    });

    // THE FORGED PRODUCER'S OWN GUARDS. A forged row states a member TABLE, and
    // the two ways that table can be written wrong are both silent: a member
    // whose label is not an integer, and two rows landing on ONE resolved key. In
    // each case the row would still go red on the refusal it expected — for a
    // reason that has nothing to do with the capability — so the harness has to
    // say which of the two happened.
    describe("the forged COSE member table", () => {
      const forged = (carries: ReadonlyArray<ForgedMember>): Scenario => ({
        id: "probe",
        title: "a probe row, for the forged member-table guards alone",
        rationale: "not a capability — this row exists only to exercise the guards.",
        given: [
          {
            step: "token",
            via: "forged",
            wire: "cose",
            claim: "act",
            carries,
            signature: "junk",
          },
        ],
        when: [{ step: "parse" }],
        then: [{ step: "accepts" }],
      });

      // ⚠⚠ THE EMPTY CELL IS THE ONE THAT MATTERED. `Number("")` is `0`, an
      // integer, so a `Number.isInteger` guard accepted a BLANK column — the form
      // a Gherkin data table produces most readily — and wrote the member at label
      // 0. The other four are `Number`'s remaining leniencies, each of which
      // resolves to a real label a row never named, so the cell and the wire would
      // disagree with nothing said.
      test.each([
        ["a text name", "sub"],
        ["an EMPTY cell", ""],
        ["a decimal point", "2.0"],
        ["surrounding space", " 2 "],
        ["hexadecimal", "0x10"],
        ["exponent notation", "1e3"],
      ])("should refuse a label written as %s", async (_form, key) => {
        await expect(
          runScenario(
            forged([{ key, keyedBy: "label", value: "service-1" }]),
            ctx,
            "cose",
          ),
        ).rejects.toThrow(/which is not an integer/);
      });

      // The control: the guard must still admit an integer label (RFC 9052 §1.5),
      // negative range included, or it would refuse every row it exists to serve.
      // The probe's verdict is `accepts` and `parse` reports a payload without
      // checking a signature, so the row RUNS TO COMPLETION — a stronger statement
      // than "not this error": the label reached the wire and came back.
      test.each([["2"], ["-70000"]])("should admit the integer label %s", async (key) => {
        await expect(
          runScenario(
            forged([{ key, keyedBy: "label", value: "service-1" }]),
            ctx,
            "cose",
          ),
        ).resolves.toBeUndefined();
      });

      test("should refuse two members that resolve to ONE key", async () => {
        // Both rows land on the integer label 2, so a `Map` would keep the last
        // and the row would state one member where it wrote two.
        await expect(
          runScenario(
            forged([
              { key: "2", keyedBy: "label", value: "audited-service" },
              { key: "2", keyedBy: "label", value: "rogue-service" },
            ]),
            ctx,
            "cose",
          ),
        ).rejects.toThrow(/twice, so one of the two could never reach the wire/);
      });
    });

    // ⚠ LOCAL cast, deliberate: the THEN tuple type makes a verdict ALONGSIDE an
    // `accepts` unreachable at compile time — a THEN that rejects holds nothing
    // but rejections — which is exactly why the runtime guard behind it is
    // otherwise never executed. Same treatment as `artifactStepOf`'s unreachable
    // guard above — a guard that has never run is a guess.
    test("should refuse a rejects step standing among observations", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the misplaced-verdict guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [{ step: "claims", claims: { subject: "user-1" } }],
        when: [{ step: "static-assert", assert: { subject: "user-1" } }],
        then: [
          { step: "accepts" },
          { step: "rejects", error: "AegisError" },
        ] as unknown as Scenario["then"],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(
        /a `rejects` step is a verdict, never an observation/,
      );
    });

    // A row may spell its refusal once per wire — the error NAMESPACE and the
    // `format` tag on the error's data are wire identifiers by construction. The
    // selection has to pick the run's OWN verdict: picking the first would make
    // every COSE run assert the JOSE spelling, and picking none would let the run
    // pass on a missing expectation.
    describe("per-wire rejection", () => {
      // A token with no `exp` — refused by the domain floor on either wire, and
      // the error names the encoding it refused, which is the one thing the two
      // verdicts cannot share.
      const probe = (then: Scenario["then"]): Scenario => ({
        id: "probe",
        title: "a probe row, for the per-wire verdict selection alone",
        rationale: "not a capability — this row exists only to exercise selection.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "structured",
            claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], iat: NOW },
          },
        ],
        when: [{ step: "verify" }],
        then,
      });

      const scoped = (jose: Wire, cose: Wire): Scenario["then"] => [
        { step: "rejects", on: jose, error: "AegisDomainError", data: { format: "jwt" } },
        { step: "rejects", on: cose, error: "AegisDomainError", data: { format: "cwt" } },
      ];

      test("should assert the verdict scoped to the wire under test", async () => {
        const scenario = probe(scoped("jose", "cose"));

        await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).resolves.toBeUndefined();
      });

      // The vacuity this guards: a scoped verdict that matches no wire would
      // otherwise leave the run with nothing to assert, and a row asserting
      // nothing passes.
      test("should fail a row whose scoped verdicts miss the wire under test", async () => {
        const scenario = probe(scoped("jose", "jose"));

        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).rejects.toThrow(/names none for the cose wire it runs on/);
      });

      // An UNSCOPED verdict is the fallback, so a row that states one refusal for
      // both wires keeps behaving exactly as it did.
      test("should fall back to an unscoped verdict on every wire", async () => {
        const scenario = probe([{ step: "rejects", error: "AegisDomainError" }]);

        await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).resolves.toBeUndefined();
      });
    });

    // An observation may be scoped to ONE wire — a raw COSE label and a raw JOSE
    // parameter name are the same fact in two vocabularies. The scope must be
    // SKIPPED on the other wire and REFUSED on a wire the row does not run on at
    // all, where it would assert nothing at all, silently.
    describe("per-wire observation", () => {
      const probe = (
        then: Scenario["then"],
        unsupported?: Scenario["unsupported"],
      ): Scenario => ({
        id: "probe",
        title: "a probe row, for the per-wire observation scope alone",
        rationale: "not a capability — this row exists only to exercise the scope.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "structured",
            claims: {
              iss: ISSUER,
              sub: "user-1",
              aud: [RESOURCE],
              exp: NOW + 3600,
              iat: NOW,
              jti: "token-1",
            },
          },
        ],
        when: [{ step: "verify" }],
        then,
        ...(unsupported ? { unsupported } : {}),
      });

      // The SKIP. The JOSE-scoped step names a text key no COSE header carries, so
      // a run that evaluated it on COSE would fail — passing there is the proof it
      // was skipped, and passing on JOSE is the proof it is not skipped everywhere.
      test("should skip an observation scoped to another wire the row also runs on", async () => {
        const scenario = probe([
          { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
          { step: "wireProtectedHeader", on: "jose", includes: { typ: "JWT" } },
          {
            step: "wireProtectedHeader",
            on: "cose",
            includes: { 16: "application/cwt" },
          },
        ]);

        await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).resolves.toBeUndefined();
      });

      // The MISS, and the vacuity it guards: the row runs on COSE alone, so the
      // JOSE-scoped step is skipped on every run there is. Without the guard the
      // row passes on both counts having checked nothing.
      test("should fail a row that scopes an observation to a wire it does not run on", async () => {
        const scenario = probe(
          [
            { step: "accepts", format: { cose: "cwt" } },
            { step: "wireProtectedHeader", on: "jose", includes: { typ: "JWT" } },
          ],
          { jose: "a stated reason" },
        );

        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).rejects.toThrow(
          /scopes a THEN step to the jose wire, which it does not run on/,
        );
      });

      // The same guard covers a scoped VERDICT: `rejectionFor` fails a wire NO
      // verdict covers, but a verdict for a wire the row never runs on is dead in
      // the other direction and nothing saw it.
      test("should fail a row that scopes a verdict to a wire it does not run on", async () => {
        const scenario = probe(
          [
            { step: "rejects", on: "cose", error: "AegisDomainError" },
            { step: "rejects", on: "jose", error: "AegisDomainError" },
          ],
          { jose: "a stated reason" },
        );

        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).rejects.toThrow(
          /scopes a THEN step to the jose wire, which it does not run on/,
        );
      });
    });

    // The ACCEPTED verdict's per-wire half. Its rejecting twin has three tests and
    // this had none — and the same wire-agnostic row reaches a DIFFERENT format on
    // each wire, so the record is the form most rows use.
    describe("per-wire accepted format", () => {
      const probe = (then: Scenario["then"]): Scenario => ({
        id: "probe",
        title: "a probe row, for the per-wire format assertion alone",
        rationale: "not a capability — this row exists only to exercise the assertion.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "structured",
            claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], exp: NOW + 3600 },
          },
        ],
        when: [{ step: "verify" }],
        then,
      });

      test("should assert the format named for the wire under test", async () => {
        const scenario = probe([
          { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
        ]);

        await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).resolves.toBeUndefined();
      });

      // The vacuity: a record that names no tag for the run's wire would otherwise
      // compare `undefined` against `undefined` and pass.
      test("should fail a record that names no format for the wire under test", async () => {
        const scenario = probe([{ step: "accepts", format: { jose: "jwt" } }]);

        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).rejects.toThrow(/names none for the cose wire it runs on/);
      });

      // A BARE tag claims the same format on every wire, which only a one-wire row
      // can be right about. Refused by name rather than surfacing as a puzzling
      // value mismatch.
      test("should refuse a bare tag on a row that runs on more than one wire", async () => {
        const scenario = probe([{ step: "accepts", format: "jwt" }]);

        await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
        await expect(
          runScenario(scenario, await createScenarioContext(), "cose"),
        ).rejects.toThrow(/the row states one format for every wire it runs on/);
      });
    });

    // A raw kit door is named wire-agnostically for the same reason a raw kit
    // SIGN is: naming `jwt` there would pin the row to JOSE through the WHEN,
    // which `pinnedWireOf` reads off the GIVEN alone and would never see.
    test("should resolve an agnostic kit-verify against the wire under test", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the agnostic kit-verify door alone",
        rationale: "not a capability — this row exists only to exercise the door.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "structured",
            claims: {
              iss: ISSUER,
              sub: "user-1",
              aud: [RESOURCE],
              exp: NOW - 3600,
              iat: NOW - 7200,
            },
          },
        ],
        when: [{ step: "kit-verify", kit: "structured" }],
        then: [{ step: "rejects", error: "AegisError" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
      await expect(
        runScenario(scenario, await createScenarioContext(), "cose"),
      ).resolves.toBeUndefined();
    });

    // The opaque doors take `VerifyUnstructuredTokenOptions`, which is the
    // structured bag MINUS the claims knobs — there are no claims to bound. A row
    // that named one would otherwise hand a bag to a door that ignores it, and
    // the row would read as a statement about an option nothing consults.
    test("should refuse a CLAIMS verify option handed to an opaque kit door", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the opaque-options guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          { step: "token", via: "kit-sign", kit: "opaque", claims: { hello: "world" } },
        ],
        when: [{ step: "kit-verify", kit: "opaque", options: { clockTolerance: 60 } }],
        then: [{ step: "accepts" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(
        /the row hands the jws door the claims verify option\(s\) clockTolerance/,
      );
      await expect(
        runScenario(scenario, await createScenarioContext(), "cose"),
      ).rejects.toThrow(
        /the row hands the cws door the claims verify option\(s\) clockTolerance/,
      );
    });

    // ⭐ THE OTHER HALF OF THE SAME GUARD, and without it the guard could be
    // widened back to "the opaque door takes nothing" and stay green: an option
    // the opaque door DOES declare must reach it. `crit` is one
    // (`src/types/kit/unstructured.ts#export type VerifyUnstructuredTokenOptions`),
    // and the token below is refused unless the declaration is forwarded — so a
    // dropped bag fails here rather than passing silently.
    test("should forward an option the opaque kit door does declare", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the opaque-options forward alone",
        rationale: "not a capability — this row exists only to exercise the forward.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "opaque",
            claims: { hello: "world" },
            options: {
              header: { crit: ["x-lindorm-hint"] },
              custom: { header: { "x-lindorm-hint": "carried" } },
            },
          },
        ],
        when: [
          { step: "kit-verify", kit: "opaque", options: { crit: ["x-lindorm-hint"] } },
        ],
        then: [{ step: "accepts" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).resolves.toBeUndefined();
      await expect(
        runScenario(scenario, await createScenarioContext(), "cose"),
      ).resolves.toBeUndefined();

      // ⚠ BY DIFFERENCE, because the acceptance above has a second explanation:
      // an opaque SIGN door that dropped `header.crit` would mint a token every
      // caller accepts, and the row would stay green with the forward removed.
      // The same row with the declaration withheld must be refused.
      const withheld: Scenario = {
        ...scenario,
        when: [{ step: "kit-verify", kit: "opaque" }],
        then: [{ step: "rejects", error: "JwsError", data: { param: "x-lindorm-hint" } }],
      };

      await expect(
        runScenario(withheld, await createScenarioContext(), "jose"),
      ).resolves.toBeUndefined();
      await expect(
        runScenario(
          {
            ...withheld,
            then: [
              { step: "rejects", error: "CwsError", data: { param: "x-lindorm-hint" } },
            ],
          },
          await createScenarioContext(),
          "cose",
        ),
      ).resolves.toBeUndefined();
    });

    /**
     * The AGNOSTIC option types, pinned at the TYPE level — the half no runtime
     * row can reach, and the same discipline the envelope pins apply
     * (`src/types/header/wire-envelope.test.ts#the wire envelope split`):
     * `@ts-expect-error` only bites under `tsc` (vitest strips types without
     * checking them), an UNUSED directive fails the typecheck, and a positive line
     * beside each refusal stops a row passing because the member vanished
     * entirely. It lives here rather than beside the envelope pins because the
     * types are the fixture layer's, and nothing under `src/types/` imports it.
     */
    test("should refuse a COSE-only member on an agnostic row, at compile time", () => {
      // The positive half. `unprotected` IS expressible: a row may state it when
      // it scopes itself `unsupported: { jose: … }`, and the JOSE leg refuses it
      // at run time (pinned by the row below this one).
      const carried: StructuredSignOptions = {
        tokenType: "at",
        custom: { header: { "x-hint": "a" }, unprotected: { "x-other": "b" } },
      };

      const respelled: StructuredSignOptions = {
        custom: {
          // @ts-expect-error an agnostic row states the JOSE spelling; the interpreter re-spells for COSE
          protected: { "x-hint": "a" },
        },
      };

      // ⛔ THE MEMBER THE TYPE HAS TO REMOVE: the COSE kits honour `proprietary`
      // and the JOSE kits ignore it, so an agnostic row stating it would be handed
      // to the two wires meaning different things.
      const structured: StructuredSignOptions = {
        tokenType: "at",
        // @ts-expect-error `proprietary` is COSE-only; an agnostic row cannot state it
        proprietary: true,
      };

      const opaque: OpaqueSignOptions = {
        tokenType: "at",
        // @ts-expect-error the agnostic opaque step is gated the same way
        proprietary: true,
      };

      const sealed: SealedSealOptions = {
        tokenType: "at",
        // @ts-expect-error the agnostic sealed step is gated the same way
        proprietary: true,
      };

      // ⭐ AND THE DOOR THAT DOES TAKE IT, so the refusals above are about the
      // AGNOSTIC step and not about the knob having been removed everywhere: a row
      // that needs it pins to a COSE wire, where the member exists.
      const pinned: CwtSignOptions = { proprietary: true };

      expect([carried, respelled, structured, opaque, sealed, pinned]).toHaveLength(6);
    });

    /**
     * ⭐ THE OTHER HALF OF `proprietary`, DERIVED RATHER THAN LISTED. The pin above
     * names that ONE member, so it says nothing about the NEXT COSE-only knob:
     * `Agnostic` omits `custom` and `proprietary` by name
     * (`src/__fixtures__/scenarios.ts#type Agnostic<T> = Omit`), so a third would survive
     * onto every agnostic row — and a bag is ASSIGNABLE to a narrower door when it
     * carries extra OPTIONAL members, so handing it to `aegis.jws.sign`
     * (`src/__fixtures__/run-scenario.ts#const joseOptionsOf`) would typecheck and
     * the member would be honoured on COSE and ignored on JOSE. That is the exact
     * divergence the agnostic OPAQUE step's docstring says must move the row to a
     * pinned wire.
     *
     * ⚠ KEYS, not shapes. `custom` is a key of both sides and passes here whatever
     * its buckets are — the interpreter TRANSLATES that one member
     * (`src/__fixtures__/run-scenario.ts#const coseCustomOf`), and the row below
     * pins the half no type can catch.
     */
    test("should give an agnostic row no member its JOSE door lacks", () => {
      type NoMemberTheJoseDoorLacks<Row, Door> =
        Exclude<keyof Row, keyof Door | "key"> extends never ? true : false;

      const structured: NoMemberTheJoseDoorLacks<
        StructuredSignOptions,
        JoseSignStructuredTokenOptions
      > = true;

      const opaque: NoMemberTheJoseDoorLacks<
        OpaqueSignOptions,
        JoseSignUnstructuredTokenOptions
      > = true;

      const sealed: NoMemberTheJoseDoorLacks<SealedSealOptions, JweEncryptOptions> = true;

      expect([structured, opaque, sealed]).toEqual([true, true, true]);
    });

    // ⭐ THE COSE-ONLY BUCKET, on the wire that has none. An agnostic row states
    // its custom bag in the JOSE spelling
    // (`src/__fixtures__/scenarios.ts#export type AgnosticCustom`), and that bag
    // SHARES `header` with the JOSE envelope's — so a row carrying `unprotected`
    // is assignable to a JOSE door and the bucket would drop SILENTLY. No type can
    // catch it; only the interpreter's refusal can, and only this row proves the
    // refusal is still there.
    test("should refuse an agnostic row's COSE-only custom bucket on the JOSE wire", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the agnostic custom-bucket guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "opaque",
            claims: { hello: "world" },
            options: { custom: { unprotected: { "x-lindorm-hint": "advisory" } } },
          },
        ],
        when: [{ step: "kit-verify", kit: "opaque" }],
        then: [{ step: "accepts" }],
      };

      await expect(runScenario(scenario, ctx, "jose")).rejects.toThrow(
        /the row places parameters in the UNPROTECTED custom bucket/,
      );

      // ⚠ BY DIFFERENCE, because the refusal above has a second explanation: a row
      // this interpreter simply could not run would reject on both wires. The
      // bucket is LEGAL on COSE, so the same row must go through there.
      await expect(
        runScenario(scenario, await createScenarioContext(), "cose"),
      ).resolves.toBeUndefined();
    });
  });

  /**
   * ⭐ THE FALSIFIER FOR `signCompactByHand`'s "THE SIGNATURE IS REAL". Every
   * scenario row routed to that producer names a `crit` member the header does
   * not carry, and `crit` is answered ahead of the signature on every JOSE read
   * path — so those rows reject identically whether the signature verifies or is
   * garbage, and the claim goes unchecked by the table. This drives the same
   * helper with a CARRIED member, where aegis reaches the signature and only a
   * real one gets past it.
   */
  describe("the hand-assembled JOSE producer", () => {
    const HAND_HEADER = {
      alg: TEST_EC_KEY_SIG.algorithm,
      kid: TEST_EC_KEY_SIG.id,
      typ: "JWT",
      crit: ["x-lindorm-hint"],
      "x-lindorm-hint": "carried",
    };

    const handSign = async (claims: Dict): Promise<string> =>
      signCompactByHand(
        HAND_HEADER,
        Buffer.from(JSON.stringify(claims), "utf8"),
        TEST_EC_KEY_SIG,
        await importJWK(
          TEST_EC_KEY_SIG.export("jwk") as never,
          TEST_EC_KEY_SIG.algorithm,
        ),
      );

    const CLAIMS = { iss: ISSUER, sub: "user-1", aud: [RESOURCE], exp: NOW + 3600 };

    test("a hand-assembled compact serialisation carries a signature aegis verifies", async () => {
      const token = await handSign(CLAIMS);

      await expect(
        ctx.aegis.verify(token, undefined, { critical: ["x-lindorm-hint"] }),
      ).resolves.toMatchObject({ format: "jwt" });
    });

    // The other half, so the assertion above is about the SIGNATURE and not
    // merely about the header: the same header and payload, carrying a
    // well-formed ES512 signature made over a DIFFERENT claims set.
    test("and one spliced from another payload's signing input does not verify", async () => {
      const token = await handSign(CLAIMS);
      const other = await handSign({ ...CLAIMS, sub: "user-2" });

      const spliced =
        token.slice(0, token.lastIndexOf(".") + 1) +
        other.slice(other.lastIndexOf(".") + 1);

      await expect(
        ctx.aegis.verify(spliced, undefined, { critical: ["x-lindorm-hint"] }),
      ).rejects.toThrow();
    });
  });
});
