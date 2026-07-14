import { describe, expect, test } from "vitest";
import { KRYPTOS_EC_SIG_ES256 } from "../fixtures/index.js";
import type { IKryptos } from "../interfaces/index.js";
import { KryptosKit } from "./index.js";

const KID = /^key_[A-Za-z0-9]{16}$/;

const ecPem = (key: { export: (f: "pem") => { privateKey?: string } }) =>
  KryptosKit.from.pem({
    algorithm: "ES256",
    type: "EC",
    use: "sig",
    curve: "P-256",
    privateKey: key.export("pem").privateKey!,
  });

describe("Kryptos key id derivation", () => {
  describe("asymmetric — deterministic thumbprint id", () => {
    test.each(["ES256", "EdDSA", "RS256", "ML-DSA-44"] as const)(
      "%s derives a `key_` thumbprint id when no id is given",
      (algorithm) => {
        expect(KryptosKit.generate.auto({ algorithm }).id).toMatch(KID);
      },
    );

    test("public-JWK re-import (kid stripped) reproduces the id", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });
      const jwk = key.toJWK("public");
      delete (jwk as { kid?: string }).kid;

      expect(KryptosKit.from.jwk(jwk).id).toBe(key.id);
    });

    test("private-PEM and env re-import reproduce the id", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect(ecPem(key).id).toBe(key.id);
      expect(KryptosKit.env.import(KryptosKit.env.export(key)).id).toBe(key.id);
    });

    test("public-only and private-only of the SAME key derive the SAME id", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });
      const pubJwk = key.toJWK("public");
      delete (pubJwk as { kid?: string }).kid;

      const publicOnly = KryptosKit.from.jwk(pubJwk);
      const privateOnly = ecPem(key);

      expect(publicOnly.hasPrivateKey).toBe(false);
      expect(privateOnly.hasPublicKey).toBe(true);
      expect(publicOnly.id).toBe(privateOnly.id);
      expect(publicOnly.id).toBe(key.id);
    });

    test("a fixed key derives a stable id (snapshot)", () => {
      const jwk = KRYPTOS_EC_SIG_ES256.toJWK("public");
      delete (jwk as { kid?: string }).kid;

      expect(KryptosKit.from.jwk(jwk).id).toMatchSnapshot();
    });

    test("different keys derive different ids", () => {
      const a = KryptosKit.generate.auto({ algorithm: "ES256" });
      const b = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect(a.id).not.toBe(b.id);
    });

    test("same key, different metadata → same id", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });
      const base = key.toJWK("public");
      delete (base as { kid?: string }).kid;

      const a = KryptosKit.from.jwk({ ...base, purpose: "access", exp: 111 });
      const b = KryptosKit.from.jwk({ ...base, purpose: "refresh", exp: 999 });

      expect(a.id).toBe(b.id);
    });
  });

  describe("explicit id always wins", () => {
    test("generate option", () => {
      expect(
        KryptosKit.generate.auto({ algorithm: "ES256", id: "key_explicit" }).id,
      ).toBe("key_explicit");
    });

    test("jwk kid", () => {
      const jwk = KryptosKit.generate.auto({ algorithm: "ES256" }).toJWK("public");
      jwk.kid = "key_customKid0000";

      expect(KryptosKit.from.jwk(jwk).id).toBe("key_customKid0000");
    });

    test("db row", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect(KryptosKit.from.db(key.toDB()).id).toBe(key.id);
    });

    test("env string", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect(KryptosKit.env.import(KryptosKit.env.export(key)).id).toBe(key.id);
    });
  });

  describe("oct — unchanged, never thumbprinted", () => {
    test("random id when generated without a path", () => {
      const a = KryptosKit.generate.auto({ algorithm: "A256KW" });
      const b = KryptosKit.generate.auto({ algorithm: "A256KW" });

      expect(a.id).toMatch(/^key_/);
      expect(a.id).not.toBe(b.id);
    });

    test("two imports of the SAME secret get different (random) ids — no secret oracle", () => {
      const jwk = KryptosKit.generate.auto({ algorithm: "A256KW" }).toJWK("private");
      delete (jwk as { kid?: string }).kid;

      const a = KryptosKit.from.jwk({ ...jwk });
      const b = KryptosKit.from.jwk({ ...jwk });

      expect(a.id).not.toBe(b.id);
    });
  });

  // Every string/buffer import path takes an OPTIONAL id: absent one it is derived
  // from the key material, supplied it is honoured verbatim. None may yield a key
  // with an empty or undefined id.
  describe("import paths — id is optional and derived", () => {
    const ASYMMETRIC = ["ES256", "EdDSA", "RS256", "ML-DSA-44"] as const;

    // A 32-byte utf8 secret: satisfies both the HS256 minimum and the A256KW size.
    const SECRET = "0123456789abcdef0123456789abcdef";

    const withoutId = <T extends { id: string }>({ id: _, ...rest }: T): Omit<T, "id"> =>
      rest;

    const importers = {
      pem: (key: IKryptos) => KryptosKit.from.pem(withoutId(key.export("pem"))),
      b64: (key: IKryptos) => KryptosKit.from.b64(withoutId(key.export("b64"))),
      der: (key: IKryptos) => KryptosKit.from.der(withoutId(key.export("der"))),
    };

    describe.each(Object.entries(importers))("from.%s", (_format, reimport) => {
      test.each(ASYMMETRIC)("%s derives the source thumbprint id", (algorithm) => {
        const key = KryptosKit.generate.auto({ algorithm });
        const imported = reimport(key);

        expect(imported.id).toMatch(KID);
        expect(imported.id).toBe(key.id);
      });

      test("a re-import is deterministic — same material, same id", () => {
        const key = KryptosKit.generate.auto({ algorithm: "ES256" });

        expect(reimport(key).id).toBe(reimport(key).id);
      });

      test("oct gets a random `key_` id — never thumbprinted, never empty", () => {
        const key = KryptosKit.generate.auto({ algorithm: "A256KW" });

        const a = reimport(key);
        const b = reimport(key);

        expect(a.id).toMatch(KID);
        expect(a.id).not.toBe(b.id);
      });

      test("an explicit id is honoured verbatim", () => {
        const key = KryptosKit.generate.auto({ algorithm: "ES256" });

        expect(reimport(key).id).not.toBe("key_explicit0000");
        expect(
          KryptosKit.from.pem({
            ...withoutId(key.export("pem")),
            id: "key_explicit0000",
          }).id,
        ).toBe("key_explicit0000");
      });
    });

    describe("from.utf", () => {
      const utf = (id?: string) =>
        KryptosKit.from.utf({
          id,
          algorithm: "HS256",
          type: "oct",
          use: "sig",
          privateKey: SECRET,
        });

      test("derives a random `key_` id when none is given", () => {
        expect(utf().id).toMatch(KID);
      });

      test("two imports of the SAME secret get different ids — no secret oracle", () => {
        expect(utf().id).not.toBe(utf().id);
      });

      test("an explicit id is honoured verbatim", () => {
        expect(utf("key_explicit0000").id).toBe("key_explicit0000");
      });
    });
  });

  test("clone keeps the source id", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });

    expect(KryptosKit.clone(key, { purpose: "rotated" }).id).toBe(key.id);
  });
});
