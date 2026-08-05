import { KryptosKit } from "@lindorm/kryptos";
import { AesKit } from "./AesKit.js";
import { describe, expect, test } from "vitest";

describe("AesKit (integration — compile-time options surface)", () => {
  const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
  const kit = new AesKit({ kryptos, encryption: "A128GCM" });

  const aad = Buffer.from("caller-supplied-aad");
  const apu = Buffer.from("Alice");
  const apv = Buffer.from("Bob");

  test("record mode takes a caller AAD; the header-derived modes reject one", () => {
    const record = kit.encrypt("payload", "record", { aad });

    // @ts-expect-error — cbor derives its AAD from the header; a caller AAD is not accepted
    kit.encrypt("payload", "cbor", { aad });

    // @ts-expect-error — serialised derives its AAD from the header; a caller AAD is not accepted
    kit.encrypt("payload", "serialised", { aad });

    // @ts-expect-error — the default mode is cbor, which derives its AAD from the header
    kit.encrypt("payload", { aad });

    expect(kit.decrypt(record, { aad })).toEqual("payload");
  });

  test("decrypt / verify / assert take only aad — apu and apv are encrypt-time", () => {
    const cipher = kit.encrypt("payload", "cbor", { apu, apv });

    // @ts-expect-error — apu is an encrypt-time parameter, carried on the header
    kit.decrypt(cipher, { apu });

    // @ts-expect-error — apv is an encrypt-time parameter, carried on the header
    kit.verify("payload", cipher, { apv });

    // @ts-expect-error — apu is an encrypt-time parameter, carried on the header
    kit.assert("payload", cipher, { apu });

    expect(kit.decrypt(cipher)).toEqual("payload");
  });
});
