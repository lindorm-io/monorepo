import { CryptoAes } from "@lindorm-io/crypto";
import { randomBytes } from "crypto";
import MockDate from "mockdate";
import { authenticator } from "otplib";
import { TotpError } from "../error";
import { TotpHandler } from "./TotpHandler";

MockDate.set("2020-01-01T08:00:15.000");

describe("TotpHandler", () => {
  let aes: CryptoAes;
  let code: string;
  let handler: TotpHandler;
  let signature: string;

  beforeEach(() => {
    const secret = randomBytes(16).toString("hex");

    handler = new TotpHandler({
      aes: { secret },
      issuer: "issuer",
    });

    aes = new CryptoAes({ secret });

    ({ signature } = handler.generate());

    code = authenticator.generate(aes.decrypt(signature));
  });

  test("should generate", () => {
    const result = handler.generate();

    expect(result.uri).toContain("otpauth://totp/issuer:");
    expect(result.uri).toContain("?secret=");
    expect(result.uri).toContain("&period=30&digits=6&algorithm=SHA1&issuer=issuer");

    expect(result.signature.length).toBe(108);
  });

  test("should verify resolving time remaining and used", () => {
    expect(handler.verify(code, signature)).toBe(true);
  });

  test("should assert", () => {
    expect(() => handler.assert(code, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => handler.assert("wrong", signature)).toThrow(TotpError);
  });
});
