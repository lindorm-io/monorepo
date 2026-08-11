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
import { encodeCnf } from "../cose/cose-key.js";
import { coseByJose } from "../header/header-registry.js";
import { KIT_CAPABILITIES } from "./kit-capabilities.js";
import { WIRE_TAGS } from "./wire.js";

const FORMATS = ["jwt", "jws", "jwe", "cwt", "cwm", "cws", "cwe"] as const;

// --- the kit probe table -----------------------------------------------------
//
// The rows below are what BINDS a capability row to the kit it describes. The
// table was previously asserted only against itself — every value read from
// KIT_CAPABILITIES and compared to a literal or to another column of the same
// row — so a kit could drift away from its row without a single test failing.
//
// Each kit is built on a fixture key that has NO certificate chain, which is what
// makes the `bindCertificate` probe below a clean detector of a `resolveCertBinding`
// call: the resolver throws for a cert-less key, so a kit that calls it throws and
// a kit that does not mints happily.

/** The three knobs the probes drive, wire-named and deliberately untyped. */
type MintProbe = {
  header?: Dict;
  unprotected?: Dict;
  bindCertificate?: "chain";
};

const logger = createMockLogger();
const CWE_KEY = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });
const BYTES = Buffer.from("kit capability probe");

// The `as never` casts hand a KitOwned wire param past the type-level Omit on
// purpose: `buildCoseHeaders`'s reserved check and the JOSE kits' spread order are
// the RUNTIME backstop, and the runtime is what these probes are binding.
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
 * Element 1 of a COSE_Sign1/Mac0/Encrypt0 array — the UNPROTECTED bucket, keyed
 * by integer label. A CWT wraps its COSE object in the CWT tag (61), so unwrap
 * until the contents are the four-element COSE array.
 */
const unprotectedMapOf = (token: string | Buffer): Map<number, unknown> => {
  let contents: unknown = decodeCbor(token as Buffer);
  while (contents instanceof Tag) contents = contents.contents;

  expect(Array.isArray(contents), "not a COSE structure").toBe(true);

  return (contents as Array<unknown>)[1] as Map<number, unknown>;
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
  test("every token format has exactly one row", () => {
    expect(Object.keys(KIT_CAPABILITIES).sort()).toEqual([...FORMATS].sort());
  });

  test("every row names a wire that exists", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(WIRE_TAGS, `${format} names an unknown wire`).toContain(row.wire);
    }
  });

  test("the wire a row names matches its format prefix", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.wire, `${format} is on the wrong wire`).toBe(
        format.startsWith("c") ? "cose" : "jose",
      );
    }
  });

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

  test("only the encrypting kits declare key management or content encryption", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      const encrypting = format === "jwe" || format === "cwe";

      expect(row.keyManagement.size > 0, `${format} key management`).toBe(encrypting);
      expect(row.contentEncryption.size > 0, `${format} content encryption`).toBe(
        encrypting,
      );
    }
  });

  test("a CWE is dir-ONLY while a JWE carries the full kryptos key-management set", () => {
    // COSE_Encrypt0 is direct encryption: `alg` (label 1) carries the CONTENT
    // encryption, so no key management happens. The other twenty kryptos
    // key managements have no COSE_Encrypt0 form.
    // ⚠ CweKit does not yet refuse a non-`dir` key itself — see the
    // `keyManagement (cwe)` binding below, which pins the foreign `@lindorm/aes`
    // error that surfaces instead. This row is the gate that makes an aegis
    // refusal expressible rather than an `if (wire === "cose")`.
    expect([...KIT_CAPABILITIES.cwe.keyManagement]).toEqual(["dir"]);
    expect(KIT_CAPABILITIES.jwe.keyManagement).toEqual(new Set(KRYPTOS_ENC_ALGORITHMS));
    expect(KIT_CAPABILITIES.jwe.keyManagement.size).toBeGreaterThan(
      KIT_CAPABILITIES.cwe.keyManagement.size,
    );
  });

  test("both encrypting kits cover the whole kryptos content-encryption set", () => {
    // COSE's official labels (AES-GCM + the eight AES-CCM variants) plus the
    // private-use AES-CBC-HMAC labels happen to be exactly the kryptos set.
    const all = new Set(AES_ENCRYPTION_ALGORITHMS);
    expect(KIT_CAPABILITIES.jwe.contentEncryption).toEqual(all);
    expect(KIT_CAPABILITIES.cwe.contentEncryption).toEqual(all);
  });

  test("a COSE cnf carries only the embedded key and the key id", () => {
    // `encodeCnf` maps `jwk` -> COSE_Key (member 1) and `kid` -> kid (member 3).
    // The thumbprint forms have NO COSE representation: RFC 9679 `ckt` hashes
    // the CBOR canonicalisation, so it is a different value than RFC 7638 `jkt`,
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

  test("no kit claims a ckt it cannot derive", () => {
    // `ckt` is in the CnfMember union so the type can describe COSE's capability
    // honestly. Nothing derives one, so nothing may claim it.
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.cnfMembers.has("ckt"), `${format} claims ckt`).toBe(false);
    }
  });

  test("the OPAQUE formats carry no claims layer, so no confirmation", () => {
    expect(KIT_CAPABILITIES.jws.cnfMembers.size).toBe(0);
    expect(KIT_CAPABILITIES.cws.cnfMembers.size).toBe(0);
  });

  test("certificate binding is a JOSE-only capability today", () => {
    // `resolveCertBinding` has ZERO COSE callers, so `bindCertificate` is
    // accepted and INERT on every COSE path. The row states what the kit can
    // do; the accept-and-ignore above it is the defect this makes refusable.
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.certificateBinding, `${format} certificate binding`).toBe(
        row.wire === "jose",
      );
    }
  });

  test("every row reserves alg and the key id", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(row.reserved, `${format} does not reserve alg`).toContain("alg");
      expect(row.reserved, `${format} does not reserve kid`).toContain("kid");
    }
  });

  test("the COSE kits do NOT reserve typ, though they compute it", () => {
    // ⚠ Recorded as-is, not corrected: `CwsKit.ts:366` / `CweKit.ts:120` pass
    // only `{alg, kid}` (`{alg, kid, iv}` for CWE) to `buildCoseHeaders`, and
    // `...options.header` spreads LAST — so a caller `typ` wins and defeats the
    // isCwt/isCws routing. The JOSE kits spread kit-last and are safe.
    for (const format of ["cwt", "cwm", "cws", "cwe"] as const) {
      expect(KIT_CAPABILITIES[format].reserved).not.toContain("typ");
    }
    for (const format of ["jwt", "jws", "jwe"] as const) {
      expect(KIT_CAPABILITIES[format].reserved).toContain("typ");
    }
  });

  test("the JWE kit reserves every key-management output it stamps", () => {
    for (const param of ["enc", "iv", "epk", "tag", "p2c", "p2s", "apu", "apv"]) {
      expect(KIT_CAPABILITIES.jwe.reserved, `jwe does not reserve ${param}`).toContain(
        param,
      );
    }
  });

  test("no row lists a reserved parameter twice", () => {
    for (const [format, row] of Object.entries(KIT_CAPABILITIES)) {
      expect(new Set(row.reserved).size, `${format} has a duplicate reserved param`).toBe(
        row.reserved.length,
      );
    }
  });

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
      // Every probe kit is built on a CERT-LESS key, so `resolveCertBinding`
      // throws `cert_binding_chain_required` when it runs at all. A kit that
      // never calls it mints happily and silently ignores the option — which is
      // the accept-and-inert defect the `false` rows record.
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

    test("unprotectedBucket: only the COSE kits carry an unprotected param to the wire", () => {
      // A JOSE compact serialisation has no unauthenticated bucket, so the kit
      // ignores the bag entirely; a COSE kit puts it in element 1 of the
      // COSE_Sign1/Mac0/Encrypt0 array. (Comparing whole tokens would NOT work —
      // an ECDSA signature differs on every mint.)
      for (const format of FORMATS) {
        const token = MINT[format]({ unprotected: { oid: "oid_probe" } });

        const carried =
          KIT_CAPABILITIES[format].wire === "cose"
            ? unprotectedMapOf(token).get(coseByJose("oid")) === "oid_probe"
            : wireHeaderOf(token).oid === "oid_probe";

        expect(carried, `${format} unprotected bucket`).toBe(
          KIT_CAPABILITIES[format].unprotectedBucket,
        );
      }
    });

    test("reserved (COSE): the kit refuses exactly the labels its row lists", () => {
      // `buildCoseHeaders` throws `cose_reserved_header` for a kit-derived label
      // in either bag. Both directions: a listed param MUST throw, and `typ` —
      // deliberately NOT listed, the recorded gap — must NOT.
      for (const format of ["cwt", "cwm", "cws", "cwe"] as const) {
        for (const param of KIT_CAPABILITIES[format].reserved) {
          expect(
            () => MINT[format]({ header: { [param]: "probe" } }),
            `${format} does not reserve "${param}"`,
          ).toThrow(/is key-derived and cannot be set/);
        }

        expect(
          () => MINT[format]({ header: { typ: "application/probe" } }),
          `${format} now reserves typ — the row must say so`,
        ).not.toThrow();
      }
    });

    test("reserved (JOSE signing kits): a caller value never survives the kit's", () => {
      // The JOSE kits have no reserved SET — the guarantee is spread order: the
      // kit's own values are written AFTER `...options.header`. This is the probe
      // JOSE_RESERVED previously had none of.
      for (const format of ["jwt", "jws"] as const) {
        for (const param of KIT_CAPABILITIES[format].reserved) {
          const header = wireHeaderOf(MINT[format]({ header: { [param]: "probe" } }));
          expect(header[param], `${format} let a caller "${param}" through`).not.toBe(
            "probe",
          );
        }

        // The control: a NON-reserved param does reach the wire, so the test
        // above is not vacuously passing on a kit that drops everything.
        const header = wireHeaderOf(
          MINT[format]({ header: { cty: "application/probe" } }),
        );
        expect(header.cty, `${format} dropped a non-reserved param`).toBe(
          "application/probe",
        );
      }
    });

    test("reserved (jwe): the row is the KitOwned type-level set plus jku", () => {
      // The JWE row is the widest, and it maps onto the KitOwned params removed
      // from `WireProtectedHeader` at the type level — plus `jku`, which the kit
      // overwrites from `kryptos.jwksUri` but which is NOT type-Omit'd.
      expect(new Set(KIT_CAPABILITIES.jwe.reserved)).toEqual(
        new Set([...Object.keys(KIT_OWNED), "jku"]),
      );

      // The signing rows are the subset that a non-encrypting kit stamps: no
      // key-management or AEAD output.
      for (const format of ["jwt", "jws"] as const) {
        expect(
          KIT_CAPABILITIES[format].reserved.every((param) =>
            KIT_CAPABILITIES.jwe.reserved.includes(param),
          ),
          `${format} reserves something the jwe row does not`,
        ).toBe(true);
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

    test("cnfMembers (cose): exactly the members encodeCnf can represent", () => {
      // `encodeCnf` is the ONLY producer of a COSE `cnf`. A member it accepts
      // ALONE is representable; one it refuses has no COSE form.
      const value: Dict = {
        jkt: "jkt_probe",
        "x5t#S256": "x5t_probe",
        jwk: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
        kid: "key_probe",
        jku: "https://issuer.lindorm.test/.well-known/jwks.json",
      };

      const representable = Object.keys(value).filter((member) => {
        try {
          encodeCnf({ [member]: value[member] });
          return true;
        } catch {
          return false;
        }
      });

      expect(new Set(representable)).toEqual(new Set(KIT_CAPABILITIES.cwt.cnfMembers));
    });

    test("keyManagement (cwe): a dir key mints, and a non-dir key fails FOREIGN", () => {
      // The dir-only row is real — but nothing in aegis enforces it. A non-`dir`
      // key is not refused by the kit; it reaches `@lindorm/aes`, which throws its
      // own `Content primitive requires a direct key` several layers down. That
      // foreign error is exactly what the capability table exists to replace with
      // aegis's own named refusal, so it is pinned here rather than described.
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
        new CweKit({ kryptos: nonDir, logger }).encrypt(BYTES, {});
      } catch (error) {
        thrown = error;
      }

      expect(thrown, "CweKit now accepts a non-dir key").toBeDefined();
      expect(
        thrown instanceof AegisError,
        "CweKit now refuses a non-dir key ITSELF — the row can become the gate",
      ).toBe(false);
    });

    test("NOT YET BINDABLE: contentEncryption and the jwe keyManagement row", () => {
      // Stated rather than faked. `JweKit` delegates the whole key-management and
      // AEAD matrix to `@lindorm/aes` without consulting a row, so neither column
      // has a runtime witness on the JOSE side; `contentEncryption` has none on
      // either wire. The declared values were hand-checked against
      // `KRYPTOS_ENC_ALGORITHMS` / `AES_ENCRYPTION_ALGORITHMS` in the tests above
      // — which is a DECLARATION check, not a binding, and stays that way until
      // the kits query the table.
      //
      // The same applies to `cnfMembers` on the OPAQUE rows (jws/cws): they carry
      // no claims layer at all, so there is no cnf producer to probe — the empty
      // set is bound by the SHAPE of the kit (it signs BYTES, not claims), which
      // the type system already holds.
      expect(KIT_CAPABILITIES.jws.cnfMembers.size).toBe(0);
      expect(KIT_CAPABILITIES.cws.cnfMembers.size).toBe(0);
    });
  });
});
