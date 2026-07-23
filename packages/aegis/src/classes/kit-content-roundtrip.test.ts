import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { CweKit } from "./CweKit.js";
import { CwsKit } from "./CwsKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";

/**
 * The content-type codec round-trip: with NO explicit cty the codec infers it from
 * the JS value and reconstructs the SAME native type on the read side — a Dict
 * round-trips through json, a string through text/plain, a Buffer through octet.
 * Proven on the REAL kit wire (sign/verify, encrypt/decrypt), not the codec alone.
 */
describe("kit content round-trip (inferred cty)", () => {
  const logger = createMockLogger();

  const dict: Dict = { sub: "user-1", scopes: ["a", "b"], n: 42, ok: true };
  const text = "an opaque string payload";
  const buffer = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

  describe("JwsKit (JOSE sign)", () => {
    const kit = new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

    test("Dict → verify returns the same Dict", () => {
      expect(kit.verify<Dict>(kit.sign(dict)).payload).toEqual(dict);
    });

    test("string → verify returns the same string", () => {
      expect(kit.verify<string>(kit.sign(text)).payload).toBe(text);
    });

    test("Buffer → verify returns the same Buffer", () => {
      expect(kit.verify<Buffer>(kit.sign(buffer)).payload).toEqual(buffer);
    });

    test("Dict → decode (keyless) returns the same Dict", () => {
      expect(kit.decode<Dict>(kit.sign(dict)).payload).toEqual(dict);
    });
  });

  describe("CwsKit (COSE sign)", () => {
    const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

    test("Dict → verify returns the same Dict", () => {
      expect(kit.verify<Dict>(kit.sign(dict)).payload).toEqual(dict);
    });

    test("string → verify returns the same string", () => {
      expect(kit.verify<string>(kit.sign(text)).payload).toBe(text);
    });

    test("Buffer → verify returns the same Buffer", () => {
      expect(kit.verify<Buffer>(kit.sign(buffer)).payload).toEqual(buffer);
    });

    test("Dict → decode (keyless) returns the same Dict", () => {
      expect(kit.decode<Dict>(kit.sign(dict)).payload).toEqual(dict);
    });
  });

  describe("JweKit (JOSE encrypt)", () => {
    const kit = new JweKit({ kryptos: TEST_EC_KEY_ENC, logger });

    test("Dict → decrypt returns the same Dict", () => {
      expect(kit.decrypt<Dict>(kit.encrypt(dict)).payload).toEqual(dict);
    });

    test("string → decrypt returns the same string", () => {
      expect(kit.decrypt<string>(kit.encrypt(text)).payload).toBe(text);
    });

    test("Buffer → decrypt returns the same Buffer", () => {
      expect(kit.decrypt<Buffer>(kit.encrypt(buffer)).payload).toEqual(buffer);
    });
  });

  describe("CweKit (COSE encrypt)", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A256GCM",
    });
    const kit = new CweKit({ kryptos, logger });

    test("Dict → decrypt returns the same Dict", () => {
      expect(kit.decrypt<Dict>(kit.encrypt(dict)).payload).toEqual(dict);
    });

    test("string → decrypt returns the same string", () => {
      expect(kit.decrypt<string>(kit.encrypt(text)).payload).toBe(text);
    });

    test("Buffer → decrypt returns the same Buffer", () => {
      expect(kit.decrypt<Buffer>(kit.encrypt(buffer)).payload).toEqual(buffer);
    });
  });
});
