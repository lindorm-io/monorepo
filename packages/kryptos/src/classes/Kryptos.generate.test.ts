import {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosEncryption,
  KryptosType,
  KryptosUse,
} from "../types";
import { KryptosKit } from "./KryptosKit";

type AutoTestCase = {
  algorithm: KryptosAlgorithm;
  type: KryptosType;
  use: KryptosUse;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
};

const autoTestCases: Array<AutoTestCase> = [
  // oct encryption (key wrapping)
  { algorithm: "A128KW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "A192KW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "A256KW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "A128GCMKW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "A192GCMKW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "A256GCMKW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "PBES2-HS256+A128KW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "PBES2-HS384+A192KW", type: "oct", use: "enc", encryption: "A256GCM" },
  { algorithm: "PBES2-HS512+A256KW", type: "oct", use: "enc", encryption: "A256GCM" },

  // oct encryption (direct — encryption required)
  { algorithm: "dir", type: "oct", use: "enc", encryption: "A256GCM" },

  // oct signature
  { algorithm: "HS256", type: "oct", use: "sig" },
  { algorithm: "HS384", type: "oct", use: "sig" },
  { algorithm: "HS512", type: "oct", use: "sig" },

  // OKP encryption (ECDH-ES direct — encryption required)
  {
    algorithm: "ECDH-ES",
    type: "OKP",
    use: "enc",
    curve: "X25519",
    encryption: "A256GCM",
  },

  // EC encryption (ECDH-ES key wrapping — encryption set by autoGenerateConfig)
  { algorithm: "ECDH-ES+A128KW", type: "EC", use: "enc", encryption: "A256GCM" },
  { algorithm: "ECDH-ES+A192KW", type: "EC", use: "enc", encryption: "A256GCM" },
  { algorithm: "ECDH-ES+A256KW", type: "EC", use: "enc", encryption: "A256GCM" },
  { algorithm: "ECDH-ES+A128GCMKW", type: "EC", use: "enc", encryption: "A256GCM" },
  { algorithm: "ECDH-ES+A192GCMKW", type: "EC", use: "enc", encryption: "A256GCM" },
  { algorithm: "ECDH-ES+A256GCMKW", type: "EC", use: "enc", encryption: "A256GCM" },

  // EC signature
  { algorithm: "ES256", type: "EC", use: "sig", curve: "P-256" },
  { algorithm: "ES384", type: "EC", use: "sig", curve: "P-384" },
  { algorithm: "ES512", type: "EC", use: "sig", curve: "P-521" },

  // OKP signature
  { algorithm: "EdDSA", type: "OKP", use: "sig", curve: "Ed25519" },

  // RSA encryption
  { algorithm: "RSA-OAEP", type: "RSA", use: "enc", encryption: "A256GCM" },
  { algorithm: "RSA-OAEP-256", type: "RSA", use: "enc", encryption: "A256GCM" },
  { algorithm: "RSA-OAEP-384", type: "RSA", use: "enc", encryption: "A256GCM" },
  { algorithm: "RSA-OAEP-512", type: "RSA", use: "enc", encryption: "A256GCM" },

  // RSA signature
  { algorithm: "RS256", type: "RSA", use: "sig" },
  { algorithm: "RS384", type: "RSA", use: "sig" },
  { algorithm: "RS512", type: "RSA", use: "sig" },
  { algorithm: "PS256", type: "RSA", use: "sig" },
  { algorithm: "PS384", type: "RSA", use: "sig" },
  { algorithm: "PS512", type: "RSA", use: "sig" },
];

describe("Kryptos generate.auto", () => {
  test.each(autoTestCases)(
    "$algorithm ($type/$use)",
    ({ algorithm, type, use, curve, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      expect(kryptos.algorithm).toEqual(algorithm);
      expect(kryptos.type).toEqual(type);
      expect(kryptos.use).toEqual(use);

      if (curve) {
        expect(kryptos.curve).toEqual(curve);
      }

      if (encryption) {
        expect(kryptos.encryption).toEqual(encryption);
      } else {
        expect(kryptos.encryption).toBeNull();
      }
    },
  );
});

describe("Kryptos export round-trip", () => {
  test.each(autoTestCases)(
    "$algorithm ($type/$use) - b64 round-trip preserves fields",
    ({ algorithm, type, use, curve, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      const exported = kryptos.export("b64");

      expect(exported.algorithm).toEqual(algorithm);
      expect(exported.type).toEqual(type);
      expect(exported.use).toEqual(use);

      if (curve) {
        expect(exported.curve).toEqual(curve);
      }

      if (encryption) {
        expect(exported.encryption).toEqual(encryption);
      } else {
        expect(exported.encryption).toBeUndefined();
      }

      // round-trip: export b64 → from b64 → export b64
      const restored = KryptosKit.from.b64({
        ...exported,
        use,
        privateKey: exported.privateKey,
        publicKey: exported.publicKey || undefined,
      });

      expect(restored.algorithm).toEqual(algorithm);
      expect(restored.type).toEqual(type);
      expect(restored.use).toEqual(use);
      expect(restored.encryption).toEqual(kryptos.encryption);

      const reExported = restored.export("b64");
      expect(reExported.algorithm).toEqual(exported.algorithm);
      expect(reExported.encryption).toEqual(exported.encryption);
    },
  );

  test.each(autoTestCases)(
    "$algorithm ($type/$use) - jwk round-trip preserves fields",
    ({ algorithm, type, use, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      const exported = kryptos.export("jwk");

      expect(exported.alg).toEqual(algorithm);
      expect(exported.kty).toEqual(type);
      expect(exported.use).toEqual(use);

      if (encryption) {
        expect(exported.enc).toEqual(encryption);
      } else {
        expect(exported.enc).toBeUndefined();
      }

      // round-trip: export jwk → from jwk → export jwk
      const restored = KryptosKit.from.jwk(exported);

      expect(restored.algorithm).toEqual(algorithm);
      expect(restored.type).toEqual(type);
      expect(restored.use).toEqual(use);
      expect(restored.encryption).toEqual(kryptos.encryption);

      const reExported = restored.export("jwk");
      expect(reExported.alg).toEqual(exported.alg);
      expect(reExported.enc).toEqual(exported.enc);
    },
  );

  test.each(autoTestCases)(
    "$algorithm ($type/$use) - toDB round-trip preserves fields",
    ({ algorithm, type, use, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      const db = kryptos.toDB();

      expect(db.algorithm).toEqual(algorithm);
      expect(db.type).toEqual(type);
      expect(db.use).toEqual(use);

      if (encryption) {
        expect(db.encryption).toEqual(encryption);
      } else {
        expect(db.encryption).toBeNull();
      }

      // round-trip: toDB → from.db → toDB
      const restored = KryptosKit.from.db(db);

      expect(restored.algorithm).toEqual(algorithm);
      expect(restored.type).toEqual(type);
      expect(restored.use).toEqual(use);
      expect(restored.encryption).toEqual(kryptos.encryption);
    },
  );

  test.each(autoTestCases)(
    "$algorithm ($type/$use) - clone preserves fields",
    ({ algorithm, type, use, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.algorithm).toEqual(algorithm);
      expect(cloned.type).toEqual(type);
      expect(cloned.use).toEqual(use);
      expect(cloned.encryption).toEqual(kryptos.encryption);
      expect(cloned.id).toEqual(kryptos.id);
    },
  );

  test.each(autoTestCases)(
    "$algorithm ($type/$use) - env round-trip preserves fields",
    ({ algorithm, type, use, encryption }) => {
      const kryptos = KryptosKit.generate.auto({ algorithm, encryption });

      const envString = KryptosKit.env.export(kryptos);
      const restored = KryptosKit.env.import(envString);

      expect(restored.algorithm).toEqual(algorithm);
      expect(restored.type).toEqual(type);
      expect(restored.use).toEqual(use);
      expect(restored.encryption).toEqual(kryptos.encryption);
    },
  );
});
