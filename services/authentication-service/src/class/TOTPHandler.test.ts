import MockDate from "mockdate";
import { CryptoAES } from "@lindorm-io/crypto";
import { TOTPError } from "../error";
import { TOTPHandler } from "./TOTPHandler";
import { authenticator } from "otplib";
import { baseParse } from "@lindorm-io/core";

MockDate.set("2020-01-01T08:00:15.000");

describe("OTPHandler", () => {
  let aes: CryptoAES;
  let code: string;
  let handler: TOTPHandler;
  let signature: string;

  beforeEach(() => {
    handler = new TOTPHandler({
      aes: { secret: "secret" },
      issuer: "issuer",
    });
    aes = new CryptoAES({ secret: "secret" });

    ({ signature } = handler.generate());

    code = authenticator.generate(aes.decrypt(baseParse(signature)));
  });

  test("should generate", () => {
    const result = handler.generate();

    expect(result.uri).toContain("otpauth://totp/issuer:");
    expect(result.uri).toContain("?secret=");
    expect(result.uri).toContain("&period=30&digits=6&algorithm=SHA1&issuer=issuer");

    expect(result.signature.length).toBe(144);
  });

  test("should verify resolving time remaining and used", () => {
    expect(handler.verify(code, signature)).toBe(true);
  });

  test("should assert", () => {
    expect(() => handler.assert(code, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => handler.assert("wrong", signature)).toThrow(TOTPError);
  });
});
