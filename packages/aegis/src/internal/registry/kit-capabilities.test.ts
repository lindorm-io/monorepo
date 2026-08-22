import { B64 } from "@lindorm/b64";
import { KRYPTOS_ENC_ALGORITHMS, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { AES_ENCRYPTION_ALGORITHMS, type Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { AegisError } from "../../errors/index.js";
import { CweKit } from "../../classes/CweKit.js";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type {
  TokenFormatTag,
  WireProtectedHeader,
  WireTokenHeader,
} from "../../types/index.js";
import { domainToJose } from "../claims/translate.js";
import { B64U } from "../constants/format.js";
import { Tag, decodeCbor } from "../cose/cbor.js";
import { decodeProtectedHeader } from "../cose/structures.js";
import { encodeCnf } from "../cose/cose-key.js";
import { coseByJose, coseWireKey } from "../header/header-registry.js";
import { decodeJoseHeader } from "../utils/jose-header.js";
import { COSE_CNF_MEMBERS } from "../claims/cnf-members.js";
import { KIT_CAPABILITIES } from "./kit-capabilities.js";
import { WIRE_TAGS } from "./wire.js";

const FORMATS = ["jwt", "jws", "jwe", "cwt", "cwm", "cws", "cwe"] as const;

// --- the kit probe table -----------------------------------------------------
//
// The rows below are what BINDS a capability row to the kit it describes; an
// assertion that reads KIT_CAPABILITIES on both sides cannot see a kit drifting
// away from its row.
//
// ⚠ Each kit is built on a fixture key with NO certificate chain, which is what
// makes the `bindCertificate` probe a clean detector of a `resolveCertBinding`
// call: the resolver throws for a cert-less key, so a kit that calls it throws and
// a kit that does not mints happily.

/** The three knobs the probes drive, wire-named and deliberately untyped. */
type MintProbe = {
  header?: Dict;
  custom?: { protected?: Dict; unprotected?: Dict };
  bindCertificate?: "chain";
};

const logger = createMockLogger();
const CWE_KEY = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });
const BYTES = Buffer.from("kit capability probe");

// The `as never` casts hand a KitOwned wire param past the type-level Omit on
// purpose: `buildCoseHeaders`'s and `buildJoseHeader`'s refusals are the RUNTIME
// backstop, and the runtime is what these probes are binding.
const MINT: Readonly<Record<TokenFormatTag, (probe: MintProbe) => string | Buffer>> = {
  jwt: (probe) =>
    new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign({}, probe as never),
  jws: (probe) =>
    new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(BYTES, probe as never),
  jwe: (probe) =>
    new JweKit({ kryptos: TEST_EC_KEY_ENC, logger }).encrypt(BYTES, probe as never),
  cwt: (probe) =>
    new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign({}, probe as never),
  cwm: (probe) =>
    new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger }).sign({}, probe as never),
  cws: (probe) =>
    new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(BYTES, probe as never),
  cwe: (probe) => new CweKit({ kryptos: CWE_KEY, logger }).encrypt(BYTES, probe as never),
};

/** The raw JOSE protected header a JOSE kit actually put on the wire. */
const wireHeaderOf = (token: string | Buffer): Dict =>
  JSON.parse(B64.toString(String(token).split(".")[0], B64U));

/**
 * Elements 0 and 1 of a COSE_Sign1/Mac0/Encrypt0 array — the PROTECTED byte
 * string and the UNPROTECTED bucket, keyed by integer label. A CWT wraps its
 * COSE object in the CWT tag (61), so unwrap until the contents are the COSE
 * array itself.
 */
const coseArrayOf = (token: string | Buffer): [Uint8Array, Map<number, unknown>] => {
  let contents: unknown = decodeCbor(token as Buffer);
  while (contents instanceof Tag) contents = contents.contents;

  expect(Array.isArray(contents), "not a COSE structure").toBe(true);

  const [protectedBstr, unprotected] = contents as Array<unknown>;

  return [protectedBstr as Uint8Array, unprotected as Map<number, unknown>];
};

/**
 * The KitOwned wire params — the type-level half of the reserved guard, derived
 * from the exported bag type rather than restated. `WireProtectedHeader` is
 * `Partial<WireTokenHeader>` minus the params a kit derives, so the difference IS
 * the KitOwned list; a change to it changes this type, which forces the witness
 * below to change, which forces the assertions to be revisited.
 */
type KitOwnedWireParam = Exclude<keyof WireTokenHeader, keyof WireProtectedHeader>;

const KIT_OWNED: Record<KitOwnedWireParam, true> = {
  alg: true,
  apu: true,
  apv: true,
  enc: true,
  epk: true,
  iv: true,
  kid: true,
  p2c: true,
  p2s: true,
  tag: true,
  typ: true,
  x5c: true,
  x5t: true,
  "x5t#S256": true,
};

describe("KIT_CAPABILITIES", () => {
  // ⚠ WHAT THE TESTS IN THIS BLOCK ARE, stated once so none of them reads as
  // coverage it does not provide.
  //
  // A DECLARATION check compares the table to itself — to a literal copy of one of
  // its own values, to another COLUMN of the same row, or to the row's own KEY. It
  // is a change detector, NOT a binding, so each one below says which it is.
  //
  // The BINDINGS are in the "bound to the kits" block. Where a kit has a PRODUCTION
  // READER for its row, "the kit refuses exactly what its row lists" is CIRCULAR:
  // the reader derives its behaviour FROM the row, so the test proves the WIRING
  // and never the row's content. Each such test says so. The per-cell tally lives
  // in `__fixtures__/coverage-census.ts`, bound by
  // `classes/Aegis.meta-coverage.test.ts`.

  // DECLARATION — and the population guard for every probe loop below, which is
  // what makes it load-bearing rather than decorative: `FORMATS` drives them all,
  // so a kit added to the table and not to `FORMATS` would simply never be probed.
  test("every token format has exactly one row", () => {
    expect(Object.keys(KIT_CAPABILITIES).sort()).toEqual([...FORMATS].sort());
  });

  // DECLARATION — the table against the runtime wire list. `wire: Wire` already
  // holds it at the type level; this catches a `WIRE_TAGS` that drifted from the
  // type it is meant to enumerate.
  test("every row names a wire that exists", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(WIRE_TAGS, `${format} names an unknown wire`).toContain(row.wire);
    }
  });

  // DECLARATION — a column against the row's own KEY. The `wire` column IS bound
  // to behaviour, by the `wire:` probe below; this pins the naming convention.
  test("the wire a row names matches its format prefix", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.wire, `${format} is on the wrong wire`).toBe(
        format.startsWith("c") ? "cose" : "jose",
      );
    }
  });

  // DECLARATION — one column against another. Bound to behaviour by the
  // `unprotectedBucket:` probe below.
  test("only the COSE kits have an unprotected bucket", () => {
    // COSE_Sign1/Mac0/Encrypt0 are `[protected, unprotected, …]`; JOSE compact
    // serialisation has one header and no unauthenticated bucket at all. This is
    // the fact that makes an unprotected `typ` representable on one wire only.
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.unprotectedBucket, `${format} unprotected bucket`).toBe(
        row.wire === "cose",
      );
    }
  });

  // DECLARATION — two columns against the row's own KEY.
  test("only the encrypting kits declare key management or content encryption", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      const encrypting = format === "jwe" || format === "cwe";

      expect(row.keyManagement.size > 0, `${format} key management`).toBe(encrypting);
      expect(row.contentEncryption.size > 0, `${format} content encryption`).toBe(
        encrypting,
      );
    }
  });

  // ⚠ AN IDENTITY, said out loud rather than left to look like a check: the `jwe`
  // row IS `new Set(KRYPTOS_ENC_ALGORITHMS)`, so it cannot fail while the row is
  // constructed that way. It is kept because it DOES fail the day somebody
  // hand-lists the row, and because the `cwe` half is a real literal bound to
  // behaviour by the `keyManagement (cwe)` probe.
  test("a CWE is dir-ONLY while a JWE carries the full kryptos key-management set", () => {
    expect([...KIT_CAPABILITIES.cwe.keyManagement]).toEqual(["dir"]);
    expect(KIT_CAPABILITIES.jwe.keyManagement).toEqual(new Set(KRYPTOS_ENC_ALGORITHMS));
    expect(KIT_CAPABILITIES.jwe.keyManagement.size).toBeGreaterThan(
      KIT_CAPABILITIES.cwe.keyManagement.size,
    );
  });

  // ⚠ THE SAME IDENTITY, on both rows: each is `new Set(AES_ENCRYPTION_ALGORITHMS)`.
  // `jwe.contentEncryption` has a reader and IS bound by the
  // `contentEncryption (jwe)` probe below; `cwe.contentEncryption` has neither a
  // reader nor a witness, which the coverage census records as `declared`.
  test("both encrypting kits cover the whole kryptos content-encryption set", () => {
    const all = new Set(AES_ENCRYPTION_ALGORITHMS);
    expect(KIT_CAPABILITIES.jwe.contentEncryption).toEqual(all);
    expect(KIT_CAPABILITIES.cwe.contentEncryption).toEqual(all);
  });

  // DECLARATION — the rows against a literal copy of the shared constants they are
  // built from. The JOSE set is bound to behaviour by the `cnfMembers:` probe below
  // (`domainToJose`). The COSE half is NOT bound here: the row DERIVES from the
  // codec's own label table, so probing the encoder could only agree with itself.
  // `cose/cose-key.test.ts` drives the encoder; `claims/cnf-members.test.ts` pins
  // the table against a literal.
  test("a COSE cnf carries only the embedded key and the key id", () => {
    // `encodeCnf` maps `jwk` -> COSE_Key (member 1) and `kid` -> kid (member 3).
    // The thumbprint forms have NO COSE representation — `ckt` (RFC 9679) hashes the
    // CBOR canonicalisation, so it is a different value than `jkt` (RFC 7638) and
    // not a translation of it.
    for (const format of ["cwt", "cwm", "cwe"] as const) {
      expect([...KIT_CAPABILITIES[format].cnfMembers].sort()).toEqual(["jwk", "kid"]);
    }
    for (const format of ["jwt", "jwe"] as const) {
      expect([...KIT_CAPABILITIES[format].cnfMembers].sort()).toEqual([
        "jkt",
        "jku",
        "jwk",
        "kid",
        "x5t#S256",
      ]);
    }
  });

  // OBSERVED, not declared. `ckt` (RFC 9679) is in the `CnfMember` union so the type
  // can describe COSE's capability honestly, and aegis derives none. The ENCODER is
  // asked directly and the rows are held to its answer — reading the value back out
  // of every row would say nothing about whether a `ckt` could be produced.
  test("no kit claims a ckt, because no producer can make one", () => {
    const derivable = ((): boolean => {
      try {
        encodeCnf({ ckt: "ckt_probe" });
        return true;
      } catch {
        return false;
      }
    })();

    expect(derivable, "a producer CAN make a ckt — the rows may now claim it").toBe(
      false,
    );

    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.cnfMembers.has("ckt"), `${format} claims ckt`).toBe(false);
    }
  });

  // The OPAQUE rows, stated ONCE. A DECLARATION and it cannot be more: an opaque kit
  // signs BYTES and has no claims layer, so there is no `cnf` producer to probe. The
  // emptiness is held by the kit's SHAPE, which the type system enforces.
  test("the OPAQUE formats carry no claims layer, so no confirmation", () => {
    expect(KIT_CAPABILITIES.jws.cnfMembers.size).toBe(0);
    expect(KIT_CAPABILITIES.cws.cnfMembers.size).toBe(0);
  });

  test("certificate binding is a capability of every kit, on both wires", () => {
    // Every kit derives its binding off the signing key through `resolveCertBinding`
    // (RFC 7515 §4.1.6, RFC 7515 §4.1.8; RFC 9360 §2). A row that said otherwise would license
    // the accept-and-ignore the disposition tables exist to refuse.
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.certificateBinding, `${format} certificate binding`).toBe(true);
    }
  });

  // DECLARATION — the rows against literals. The COSE rows are bound by the
  // (circular) reserved probe; the JOSE rows by the spread-order probe, which is
  // not circular because no JOSE kit reads its row.
  test("every row reserves alg and the key id", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.reserved, `${format} does not reserve alg`).toContain("alg");
      expect(row.reserved, `${format} does not reserve kid`).toContain("kid");
    }
  });

  // DECLARATION — same standing as the one above.
  test("every row reserves typ, because typ is what routes a token", () => {
    // `typ` decides which format a token IS (`isCwt`/`isCws`) and which profile floor
    // applies, so a caller must never be able to state it.
    for (const format of FORMATS) {
      expect(
        KIT_CAPABILITIES[format].reserved,
        `${format} does not reserve typ`,
      ).toContain("typ");
    }
  });

  // DECLARATION — the row against a literal list.
  test("the JWE kit reserves every key-management output it stamps", () => {
    for (const param of ["enc", "iv", "epk", "tag", "p2c", "p2s", "apu", "apv"]) {
      expect(KIT_CAPABILITIES.jwe.reserved, `jwe does not reserve ${param}`).toContain(
        param,
      );
    }
  });

  // A WELL-FORMEDNESS check on the data itself, not a comparison with anything —
  // the one test in this block that is neither declaration nor binding.
  test("no row lists a reserved parameter twice", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(new Set(row.reserved).size, `${format} has a duplicate reserved param`).toBe(
        row.reserved.length,
      );
    }
  });

  /**
   * ⭐ THE WHOLE ROW, for every format — the one pin that states what `reserved`
   * CONTAINS rather than what it must contain.
   *
   * Every other assertion above is PARTIAL, and a partial assertion cannot see a
   * parameter LEAVING a row — at which point it stops being refused and a caller
   * writes it onto the wire under the kit's own name. The COSE binding probe below
   * reads the row to decide what to refuse, so it agrees with whatever the row says.
   *
   * ⚠ Sorted, because `reserved` is a refusal SET: the order the two source arrays
   * happen to be written in is not a property anything depends on, and pinning it
   * would make a re-ordering read as a capability change.
   *
   * ⚠ A HARD COUNT beside the snapshot, deliberately not snapshotted: `vitest -u`
   * rewrites a snapshot without anyone reading the diff. A plain assertion cannot
   * be updated by `-u`.
   *
   * ⚠ "reserves", not "stamps". A row is the whole `KitOwnedHeaderParam` set less
   * what its wire cannot carry — NOT the set the kit derives. A signing kit derives
   * no key-management output and reserves every one of them, because otherwise a
   * caller value rides onto a signed token advertising a content encryption that
   * never happened.
   */
  test.each(FORMATS)(
    "%s reserves exactly its KitOwned params, filtered to its wire",
    (format) => {
      const reserved = [...KIT_CAPABILITIES[format].reserved].sort();

      expect(reserved).toHaveLength(KIT_CAPABILITIES[format].wire === "jose" ? 14 : 6);
      expect(reserved).toMatchSnapshot();
    },
  );

  // --- BINDINGS: each row checked against the kit it describes ---------------

  describe("bound to the kits", () => {
    test("wire: a JOSE kit mints a compact STRING, a COSE kit mints CBOR bytes", () => {
      for (const format of FORMATS) {
        const token = MINT[format]({});
        expect(typeof token, `${format} mint output`).toBe(
          KIT_CAPABILITIES[format].wire === "jose" ? "string" : "object",
        );
        if (KIT_CAPABILITIES[format].wire === "cose") {
          expect(Buffer.isBuffer(token), `${format} mints bytes`).toBe(true);
        }
      }
    });

    test("certificateBinding: exactly the rows that call resolveCertBinding", () => {
      // Every probe kit is built on a CERT-LESS key, so `resolveCertBinding` throws
      // `cert_binding_chain_required` when it runs at all. A kit that never calls it
      // mints happily and silently ignores the option.
      for (const format of FORMATS) {
        const mint = () => MINT[format]({ bindCertificate: "chain" });

        if (KIT_CAPABILITIES[format].certificateBinding) {
          expect(mint, `${format} claims cert binding but ignores it`).toThrow(
            /bindCertificate requires kryptos with certificateChain/,
          );
        } else {
          expect(mint, `${format} disclaims cert binding but enforces it`).not.toThrow();
        }
      }
    });

    test("unprotectedBucket: the kit's own kid rides element 1 only where the row says one exists", () => {
      // The column names a STRUCTURAL fact, so it is measured on the parameter every
      // kit stamps for itself — `kid` — and WHERE IT LANDS is the fact. A COSE kit
      // puts it in element 1 of the COSE_Sign1/Mac0/Encrypt0 array (RFC 9052 §3.1); a
      // JOSE compact serialisation has one header (RFC 7515 §7.1).
      //
      // ⚠ It cannot be measured with a CALLER's `unprotected` value: the header
      // registry's `placement` column permits no caller-settable parameter in that
      // bucket on any kit, so the kit would refuse it.
      for (const format of FORMATS) {
        const token = MINT[format]({});

        const bucket = ((): string => {
          if (KIT_CAPABILITIES[format].wire === "jose") {
            return wireHeaderOf(token).kid === undefined ? "absent" : "protected";
          }

          const [protectedBstr, unprotected] = coseArrayOf(token);

          if (unprotected.has(coseByJose("kid"))) return "unprotected";
          if (decodeProtectedHeader(Buffer.from(protectedBstr)).has(coseByJose("kid"))) {
            return "protected";
          }
          return "absent";
        })();

        expect(bucket, `${format} kid bucket`).toBe(
          KIT_CAPABILITIES[format].unprotectedBucket ? "unprotected" : "protected",
        );
      }
    });

    test("reserved (COSE): the kit refuses exactly the labels its row lists", () => {
      // ⚠ CIRCULAR, and worth having anyway. `buildCoseHeaders` reads THIS ROW to
      // decide what to refuse, so it proves the WIRING and never the row's content;
      // what the row SHOULD contain is a declaration check above. The negative half
      // is NOT circular: a param the row does not list must reach the wire, which a
      // kit that refused everything would fail.
      //
      // ⚠ EVERY DOOR TO EITHER BUCKET. `header` is the registered one and travels
      // protected; `custom.protected`/`custom.unprotected` are the only way to reach
      // a bucket with an unregistered key — and `iv` is `placement: "either"`, so the
      // reserved row is the ONLY thing between a caller and a signature-uncovered
      // `iv` in element 1.
      for (const format of ["cwt", "cwm", "cws", "cwe"] as const) {
        for (const param of KIT_CAPABILITIES[format].reserved) {
          expect(
            () => MINT[format]({ header: { [param]: "probe" } }),
            `${format} does not reserve "${param}" in the header bag`,
          ).toThrow(/is key-derived and cannot be set/);

          for (const bucket of ["protected", "unprotected"] as const) {
            expect(
              () => MINT[format]({ custom: { [bucket]: { [param]: "probe" } } }),
              `${format} does not reserve "${param}" in the custom.${bucket} bag`,
            ).toThrow(/is key-derived and cannot be set/);
          }
        }

        expect(
          () => MINT[format]({ header: { oid: "1.2.3.4" } }),
          `${format} refuses a param its row does not reserve`,
        ).not.toThrow();
      }
    });

    test("reserved (JOSE): the kit REFUSES exactly the params its row lists", () => {
      // ⚠ CIRCULAR in the same way the COSE probe is: `buildJoseHeader` reads THIS
      // ROW to decide what to refuse out of the caller's bag, so the positive half
      // proves the WIRING and never the row's content. What the row SHOULD contain is
      // the equality check below.
      //
      // ⚠ IT THROWS RATHER THAN DROPPING, matching COSE. A silent drop turns
      // `header: { enc: "A256GCM" } as never` on a JWT into a token the caller never
      // asked for, with nothing reported. Spread ORDER is not a substitute either: it
      // relies on the kit HAVING a value for every reserved param, and an absent one
      // writes `undefined` over the caller's and takes the parameter off the wire.
      for (const format of ["jwt", "jws", "jwe"] as const) {
        for (const param of KIT_CAPABILITIES[format].reserved) {
          expect(
            () => MINT[format]({ header: { [param]: "probe" } }),
            `${format} does not reserve "${param}"`,
          ).toThrow(/is key-derived and cannot be set/);
        }

        // The negative half, which is NOT circular: a param the row does not
        // list must reach the wire, so the loop above cannot pass on a kit that
        // refuses everything.
        const header = wireHeaderOf(
          MINT[format]({ header: { cty: "application/probe" } }),
        );
        expect(header.cty, `${format} dropped a non-reserved param`).toBe(
          "application/probe",
        );
      }
    });

    // ⭐ THE BINDING THAT CLOSES THE ROWS, by EQUALITY. A subset relation would be
    // satisfied by the empty set, which leaves a caller free to forge a certificate
    // chain onto a CWT (nothing else writes label 33, so the forgery would be the
    // only chain present) or put a signature-uncovered `iv` in a CWS's unprotected
    // bucket.
    //
    // ⚠ The expected sets are LITERALS, deliberately. Reading them back out of
    // `KIT_CAPABILITIES` — the constant the production code reads — would make the
    // test agree with any row that was ever written.
    test("reserved: every row IS its KitOwned set, filtered to what its wire carries", () => {
      const JOSE_EXPECTED = [
        "alg",
        "apu",
        "apv",
        "enc",
        "epk",
        "iv",
        "kid",
        "p2c",
        "p2s",
        "tag",
        "typ",
        "x5c",
        "x5t",
        "x5t#S256",
      ];

      // The KitOwned params the COSE wire has a label for. `x5t#S256` maps to label
      // 34, whose hash algorithm is a member of its VALUE — which is why the
      // SHA-1-named `x5t` is not here (RFC 9360 §2).
      const COSE_EXPECTED = ["alg", "iv", "kid", "typ", "x5c", "x5t#S256"];

      // JOSE carries every KitOwned param, so the JOSE literal must BE the type-level
      // set — the runtime backstop and the compile-time Omit stating one set, not
      // two. (`jku` is on neither: the type offers it to callers, and a row that
      // reserved it would REFUSE a caller's value, not discard it.)
      expect(new Set(JOSE_EXPECTED)).toEqual(new Set(Object.keys(KIT_OWNED)));

      // …and the COSE literal must be exactly the part of that set the COSE wire can
      // spell. `buildCoseHeaders` puts every reserved name through `coseWireKey`, so
      // a param it refuses cannot be listed on a COSE row without breaking every mint
      // that kit makes.
      const carriable = Object.keys(KIT_OWNED).filter((param) => {
        try {
          coseWireKey(param, false);
          return true;
        } catch {
          return false;
        }
      });

      expect(new Set(COSE_EXPECTED)).toEqual(new Set(carriable));

      for (const format of ["jwt", "jws", "jwe"] as const) {
        expect(
          new Set(KIT_CAPABILITIES[format].reserved),
          `${format} reserves something other than its KitOwned set`,
        ).toEqual(new Set(JOSE_EXPECTED));
      }

      for (const format of ["cwt", "cwm", "cws", "cwe"] as const) {
        expect(
          new Set(KIT_CAPABILITIES[format].reserved),
          `${format} reserves something other than its carriable KitOwned set`,
        ).toEqual(new Set(COSE_EXPECTED));
      }
    });

    test("reserved (JOSE): jku is NOT on it, so a caller's own reaches the wire", () => {
      // The complement of the drop probe, and the one parameter this suite states
      // positively: `jku` sits in the DEFAULTS tier, so the key's `jwksUri` fills in
      // and a caller's value outranks it.
      //
      // ⚠ Both halves matter and each fails on a different mistake — a key that
      // PUBLISHES a jwks uri is what a reserved `jku` loses, and a key that publishes
      // NONE is what spread order loses by writing `undefined` over the caller.
      const KEYLESS = {
        jwt: KryptosKit.generate.sig.ec({ algorithm: "ES512" }),
        jws: KryptosKit.generate.sig.ec({ algorithm: "ES512" }),
        jwe: KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES" }),
      } as const;

      const KEYLESS_MINT: Record<keyof typeof KEYLESS, (probe: MintProbe) => string> = {
        jwt: (probe) =>
          new JwtKit({ kryptos: KEYLESS.jwt, logger }).sign({}, probe as never),
        jws: (probe) =>
          new JwsKit({ kryptos: KEYLESS.jws, logger }).sign(BYTES, probe as never),
        jwe: (probe) =>
          new JweKit({ kryptos: KEYLESS.jwe, logger }).encrypt(BYTES, probe as never),
      };

      for (const format of ["jwt", "jws", "jwe"] as const) {
        expect(KIT_CAPABILITIES[format].reserved, `${format} reserves jku`).not.toContain(
          "jku",
        );

        expect(KEYLESS[format].jwksUri, `${format} probe key publishes a jwks uri`).toBe(
          null,
        );

        expect(
          wireHeaderOf(MINT[format]({})).jku,
          `${format} did not default jku to the key's own`,
        ).toBe("https://test.lindorm.io/.well-known/jwks.json");

        expect(
          wireHeaderOf(
            MINT[format]({ header: { jku: "https://caller.lindorm.test/jwks.json" } }),
          ).jku,
          `${format} let the key's jwks uri overwrite the caller's`,
        ).toBe("https://caller.lindorm.test/jwks.json");

        expect(
          wireHeaderOf(
            KEYLESS_MINT[format]({
              header: { jku: "https://caller.lindorm.test/jwks.json" },
            }),
          ).jku,
          `${format} dropped the caller's jku for a key that publishes none`,
        ).toBe("https://caller.lindorm.test/jwks.json");

        expect(
          wireHeaderOf(KEYLESS_MINT[format]({})).jku,
          `${format} invented a jku for a key that publishes none`,
        ).toBeUndefined();
      }
    });

    test("cnfMembers (jose): exactly the members the translator emits", () => {
      // `domainToJose` is the ONLY producer of a JOSE `cnf`, so the keys it emits
      // for a fully-populated confirmation ARE the JOSE capability.
      const { cnf } = domainToJose({
        confirmation: {
          thumbprint: "jkt_probe",
          mtlsCertThumbprint: "x5t_probe",
          key: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
          keyId: "key_probe",
          jwkSetUri: "https://issuer.lindorm.test/.well-known/jwks.json",
        },
      });

      expect(new Set(Object.keys(cnf as Dict))).toEqual(
        new Set(KIT_CAPABILITIES.jwt.cnfMembers),
      );
      expect(KIT_CAPABILITIES.jwe.cnfMembers).toBe(KIT_CAPABILITIES.jwt.cnfMembers);
    });

    test("cnfMembers (cose): the row is DERIVED from the codec's label table", () => {
      // ⚠ CIRCULAR, and stated as such. `encodeCnf` and this row read the same
      // `COSE_CNF_LABELS`, so probing the encoder and comparing it with the row can
      // only agree — which is the POINT: the two cannot drift.
      //
      // ⭐ WHAT MAKES THAT ACCEPTABLE: what the row SHOULD contain is pinned against a
      // HAND-WRITTEN literal in `claims/cnf-members.test.ts`. Without that literal
      // this assertion would be the only statement about the set, and would say
      // nothing.
      expect(new Set(KIT_CAPABILITIES.cwt.cnfMembers)).toEqual(new Set(COSE_CNF_MEMBERS));
      expect(KIT_CAPABILITIES.cwm.cnfMembers).toBe(KIT_CAPABILITIES.cwt.cnfMembers);
      expect(KIT_CAPABILITIES.cwe.cnfMembers).toBe(KIT_CAPABILITIES.cwt.cnfMembers);
    });

    test("keyManagement (cwe): the kit refuses a key its row does not list", () => {
      // ⚠ CIRCULAR in the same way — `CweKit`'s constructor reads this row — and kept
      // for the same reason: it proves the constructor consults the row and pins the
      // SHAPE of the refusal a caller sees. Without it a non-`dir` key reaches
      // `@lindorm/aes`, which throws a foreign error naming neither the wire nor the
      // reason.
      expect([...KIT_CAPABILITIES.cwe.keyManagement]).toEqual(["dir"]);
      expect(() =>
        new CweKit({ kryptos: CWE_KEY, logger }).encrypt(BYTES, {}),
      ).not.toThrow();

      const nonDir = KryptosKit.generate.enc.oct({
        algorithm: "A256KW",
        encryption: "A256GCM",
      });

      let thrown: unknown;
      try {
        new CweKit({ kryptos: nonDir, logger });
      } catch (error) {
        thrown = error;
      }

      expect(thrown, "CweKit accepts a key its row does not list").toBeInstanceOf(
        AegisError,
      );
      expect(thrown).toMatchObject({
        code: "cose_key_management_unsupported",
        data: { algorithm: "A256KW", supported: ["dir"] },
      });
    });

    test("contentEncryption (jwe): the JOSE header decoder allowlists enc off the row", () => {
      // ⚠ CIRCULAR on the accepting half — the decoder allowlists off this row — but
      // the REFUSING half is real: `A128CBC-HS128` is not a kryptos encryption at
      // all, so the row could not list it however it was written.
      //
      // The read-side binding: `enc` arrives as an arbitrary wire STRING, so a header
      // naming an encryption the row does not list is refused at decode, before any
      // key or AEAD work.
      const [supported] = [...KIT_CAPABILITIES.jwe.contentEncryption];

      const header = (enc: string): string =>
        B64.encode(JSON.stringify({ alg: "ES512", enc, typ: "JWE" }), B64U);

      expect(() => decodeJoseHeader(header(supported))).not.toThrow();
      expect(() => decodeJoseHeader(header("A128CBC-HS128"))).toThrow(
        /Unsupported encryption/,
      );
    });

    // ⚠ NOT A TEST. The per-cell tally lives in `__fixtures__/coverage-census.ts`,
    // which records for each capability cell whether a kit READS it, a probe
    // OBSERVES it, or neither, and is bound to the real table by
    // `classes/Aegis.meta-coverage.test.ts`. `jwe.keyManagement` is `declared`
    // there: `JweKit` hands the whole key-management matrix to `@lindorm/aes` without
    // consulting a row, so the column has no runtime witness and its declared value
    // is built FROM `KRYPTOS_ENC_ALGORITHMS`.
  });
});
