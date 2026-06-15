import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { CweKit } from "./CweKit.js";

describe("CweKit (COSE_Encrypt0)", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through encrypt -> CBOR -> decrypt", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const encrypt0 = kit.encrypt(payload, { typ: "application/at+cwt" });
    const decoded = decodeCbor(encodeCbor(encrypt0));
    const { payload: out, protectedHeader } = kit.decrypt(decoded);

    expect(out.equals(payload)).toBe(true);
    expect(protectedHeader.get(1)).toBe(3); // A256GCM label
  });

  test("rejects tampered ciphertext", () => {
    const encrypt0 = kit.encrypt(Buffer.from("secret payload"));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.decrypt(encrypt0)).toThrow();
  });
});
