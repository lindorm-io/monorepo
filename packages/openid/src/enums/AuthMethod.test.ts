import { describe, expect, test } from "vitest";
import { AuthMethod } from "./AuthMethod.js";

describe("AuthMethod", () => {
  test("should match snapshot", () => {
    expect(AuthMethod).toMatchSnapshot();
  });

  test("should carry the RFC 8176 registry values verbatim", () => {
    // The wire values are the registry's abbreviations, NOT the readable keys.
    expect(AuthMethod.Fingerprint).toBe("fpt");
    expect(AuthMethod.Password).toBe("pwd");
    expect(AuthMethod.MultipleFactor).toBe("mfa");
    expect(AuthMethod.ProofOfPossession).toBe("pop");
    expect(AuthMethod.HardwareKey).toBe("hwk");
    expect(AuthMethod.SoftwareKey).toBe("swk");
    expect(AuthMethod.Voice).toBe("vbm");
    expect(AuthMethod.WindowsIntegrated).toBe("wia");
  });

  test("should cover the full registry", () => {
    expect(Object.values(AuthMethod).sort()).toEqual(
      [
        "face",
        "fpt",
        "geo",
        "hwk",
        "iris",
        "kba",
        "mca",
        "mfa",
        "otp",
        "pin",
        "pop",
        "pwd",
        "rba",
        "retina",
        "sc",
        "sms",
        "swk",
        "tel",
        "user",
        "vbm",
        "wia",
      ].sort(),
    );
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: AuthMethod = AuthMethod.Password;
    const fromLiteral: AuthMethod = "otp";
    // @ts-expect-error the type is CLOSED — a vendor factor is not an AuthMethod
    const rejected: AuthMethod = "vendor:face_liveness";
    // a deployment using a vendor factor widens in ITS OWN package, never here
    const widened: AuthMethod | "vendor:face_liveness" = "vendor:face_liveness";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });
});
