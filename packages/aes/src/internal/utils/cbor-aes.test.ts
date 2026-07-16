import { KryptosKit } from "@lindorm/kryptos";
import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { AesKit } from "../../classes/AesKit.js";
import { AES_CBOR_KIT } from "../constants/cbor-spec.js";
import { encryptCbor } from "./encrypt-cbor.js";
import { parseCborAesString } from "./cbor-aes.js";

describe("cbor-aes", () => {
  test("round-trips a dir record through the cbor wire", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A256GCM",
    });
    const kit = new AesKit({ kryptos, encryption: "A256GCM" });

    const cipher = kit.encrypt({ hello: "world" }, "cbor");

    expect(cipher.startsWith("aes:")).toBe(true);
    expect(kit.decrypt(cipher)).toEqual({ hello: "world" });
  });

  test("round-trips a key-wrap record (with wrapped CEK) through the cbor wire", () => {
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
    const kit = new AesKit({ kryptos, encryption: "A256GCM" });

    const cipher = kit.encrypt("secret", "cbor");
    const parsed = parseCborAesString(cipher);

    expect(parsed.publicEncryptionKey).toBeInstanceOf(Buffer);
    expect(kit.decrypt(cipher)).toEqual("secret");
  });

  test("recomputes an AAD identical to the encrypt-time AAD (tamper-evident header)", () => {
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
    const cipher = encryptCbor({
      data: "payload",
      encryption: "A256GCM",
      kryptos,
    });

    const bytes = B64.toBuffer(cipher.slice(4), "b64u");
    const decoded = AES_CBOR_KIT.decode(new Uint8Array(bytes));

    // Flipping any header enum breaks the GCM tag because the header is the AAD.
    const parsed = parseCborAesString(cipher);
    const tampered = AES_CBOR_KIT.encode({
      ...decoded,
      encryption: "A128GCM",
    });

    expect(() =>
      new AesKit({ kryptos, encryption: "A256GCM" }).decrypt(
        `aes:${B64.encode(Buffer.from(tampered), "b64u")}`,
      ),
    ).toThrow();
    expect(parsed.aad).toBeInstanceOf(Buffer);
  });

  test("throws on a string without the aes: prefix", () => {
    expect(() => parseCborAesString("not-a-cbor-string")).toThrow(
      "must start with 'aes:'",
    );
  });

  test("cbor wire decodes to the expected field set (dir vs key-wrap)", () => {
    const dirKit = new AesKit({
      kryptos: KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" }),
      encryption: "A256GCM",
    });
    const kwKit = new AesKit({
      kryptos: KryptosKit.generate.enc.oct({ algorithm: "A256KW" }),
      encryption: "A256GCM",
    });

    const decode = (cipher: string): Array<string> =>
      Object.keys(
        AES_CBOR_KIT.decode(new Uint8Array(B64.toBuffer(cipher.slice(4), "b64u"))),
      ).sort();

    expect({
      dir: decode(dirKit.encrypt("x", "cbor")),
      keyWrap: decode(kwKit.encrypt("x", "cbor")),
    }).toMatchSnapshot();
  });
});
