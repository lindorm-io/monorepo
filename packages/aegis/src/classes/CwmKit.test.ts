import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { CwmKit } from "./CwmKit.js";

describe("CwmKit (COSE_Mac0)", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
  const kit = new CwmKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through tag -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const mac0 = kit.tag(payload, { typ: "application/at+cwt" });
    const decoded = decodeCbor(encodeCbor(mac0));
    const { payload: out, protectedHeader } = kit.verify(decoded);

    expect(out.equals(payload)).toBe(true);
    expect(protectedHeader.get(1)).toBe(5); // HS256 label
  });

  test("rejects a tampered payload", () => {
    const mac0 = kit.tag(Buffer.from("authentic"));
    const arr = mac0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.verify(mac0)).toThrow(AegisError);
  });
});
