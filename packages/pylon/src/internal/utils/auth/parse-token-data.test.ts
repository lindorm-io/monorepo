import { AegisError } from "@lindorm/aegis";
import MockDate from "mockdate";
import { CannotEstablishSessionIdentity } from "../../../errors";
import { parseTokenData } from "./parse-token-data";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn().mockImplementation(() => "c8ff3952-8ba4-51a3-a4d5-2f0726c49524"),
}));

const createJwtVerifyResult = (overrides: Record<string, any> = {}) => ({
  payload: {
    expiresAt: new Date("2024-01-02T08:00:00.000Z"),
    issuedAt: new Date("2024-01-01T08:00:00.000Z"),
    sessionId: "85924874-c05c-5574-ad85-0cf2cf39be95",
    subject: "4e294800-be7e-5954-b143-0ebdcf393906",
    ...overrides,
  },
  header: { baseFormat: "JWT" as const },
  decoded: {},
  token: "jwt-token",
});

const createJwsVerifyResult = () => ({
  payload: "some-payload",
  header: { baseFormat: "JWS" as const },
  decoded: {},
  token: "jws-token",
});

describe("parseTokenData", () => {
  let aegis: any;
  let data: any;

  beforeEach(() => {
    aegis = {
      verify: vi.fn().mockResolvedValue(createJwtVerifyResult()),
    };

    data = {
      accessToken: "accessToken",
      code: "code",
      expiresIn: 3600,
      expiresOn: Math.floor(new Date("2024-01-01T09:00:00.000Z").getTime() / 1000),
      idToken: "idToken",
      refreshToken: "refreshToken",
      scope: "scope1 scope2",
      state: "state",
      tokenType: "Bearer",
    };
  });

  afterEach(vi.clearAllMocks);

  test("should resolve subject and expiresAt from JWT access token", async () => {
    data.idToken = undefined;
    data.refreshToken = undefined;

    const result = await parseTokenData(aegis, data);
    expect(result).toMatchSnapshot();
  });

  test("should fall through when access token verifies as JWS (non-JWT)", async () => {
    aegis.verify.mockResolvedValueOnce(createJwsVerifyResult());
    // second call for id_token should return JWT
    aegis.verify.mockResolvedValueOnce(createJwtVerifyResult());

    const result = await parseTokenData(aegis, data);
    expect(result).toMatchSnapshot();
  });

  test("should fall through when access token verify throws AegisError (opaque token)", async () => {
    aegis.verify.mockRejectedValueOnce(new AegisError("Invalid token type"));
    // id_token verify returns JWT
    aegis.verify.mockResolvedValueOnce(createJwtVerifyResult());

    const result = await parseTokenData(aegis, data);
    expect(result).toMatchSnapshot();
  });

  test("should resolve subject from id_token when access token has no subject", async () => {
    aegis.verify
      .mockResolvedValueOnce(createJwtVerifyResult({ subject: "" }))
      .mockResolvedValueOnce(createJwtVerifyResult());

    data.refreshToken = undefined;

    const result = await parseTokenData(aegis, data);
    expect(result).toMatchSnapshot();
  });

  test("should resolve subject via resolveSubject callback when no id_token", async () => {
    aegis.verify.mockRejectedValueOnce(new AegisError("opaque"));

    data.idToken = undefined;

    const resolveSubject = vi.fn().mockResolvedValue("userinfo-subject");

    const result = await parseTokenData(aegis, data, { resolveSubject });
    expect(result).toMatchSnapshot();
    expect(resolveSubject).toHaveBeenCalledWith("accessToken");
  });

  test("should throw CannotEstablishSessionIdentity when no subject found", async () => {
    aegis.verify.mockRejectedValueOnce(new AegisError("opaque"));

    data.idToken = undefined;

    await expect(parseTokenData(aegis, data)).rejects.toThrow(
      CannotEstablishSessionIdentity,
    );
  });

  test("should re-throw non-AegisError from verify", async () => {
    const error = new TypeError("network failure");
    aegis.verify.mockRejectedValueOnce(error);

    await expect(parseTokenData(aegis, data)).rejects.toThrow(TypeError);
  });

  test("should parse all tokens correctly", async () => {
    const result = await parseTokenData(aegis, data, { defaultTokenExpiry: "1h" });
    expect(result).toMatchSnapshot();
  });

  test("should preserve existing session fields on refresh", async () => {
    const existingSession = {
      id: "35e8805b-2352-5c71-871a-19e8545540ce",
      accessToken: "existingAccessToken",
      expiresAt: new Date("2024-01-01T09:20:00.000Z"),
      idToken: "existingIdToken",
      issuedAt: new Date("2024-01-01T07:54:00.000Z"),
      refreshToken: "existingRefreshToken",
      scope: ["scope1", "scope2"],
      subject: "efd9178b-778b-53ce-b929-da87c320140e",
    };

    data = { accessToken: "accessToken" };

    aegis.verify.mockRejectedValueOnce(new AegisError("opaque"));

    const result = await parseTokenData(aegis, data, {
      defaultTokenExpiry: "1h",
      session: existingSession,
    });

    expect(result).toMatchSnapshot();
  });

  test("should compute expiresAt from expiresIn when no token claims", async () => {
    aegis.verify.mockRejectedValueOnce(new AegisError("opaque"));
    aegis.verify.mockResolvedValueOnce(createJwtVerifyResult());

    delete data.expiresOn;

    const result = await parseTokenData(aegis, data);
    expect(result).toMatchSnapshot();
  });

  test("should resolve scope from id_token when access token is opaque and envelope has no scope", async () => {
    aegis.verify
      .mockRejectedValueOnce(new AegisError("opaque"))
      .mockResolvedValueOnce(
        createJwtVerifyResult({ scope: ["openid", "profile", "email"] }),
      );

    delete data.scope;
    data.refreshToken = undefined;

    const result = await parseTokenData(aegis, data);
    expect(result.scope).toEqual(["openid", "profile", "email"]);
    expect(result).toMatchSnapshot();
  });

  test("envelope scope takes precedence over id_token scope", async () => {
    aegis.verify
      .mockRejectedValueOnce(new AegisError("opaque"))
      .mockResolvedValueOnce(createJwtVerifyResult({ scope: ["ignored-from-idtoken"] }));

    data.scope = "envelope1 envelope2";
    data.refreshToken = undefined;

    const result = await parseTokenData(aegis, data);
    expect(result.scope).toEqual(["envelope1", "envelope2"]);
  });

  test("access token JWT scope takes precedence over envelope", async () => {
    aegis.verify.mockResolvedValueOnce(
      createJwtVerifyResult({ scope: ["from-jwt-claim"] }),
    );

    data.scope = "envelope1 envelope2";
    data.idToken = undefined;
    data.refreshToken = undefined;

    const result = await parseTokenData(aegis, data);
    expect(result.scope).toEqual(["from-jwt-claim"]);
  });

  test("should compute expiresAt from tokenExpiry fallback", async () => {
    aegis.verify.mockRejectedValueOnce(new AegisError("opaque"));
    aegis.verify.mockResolvedValueOnce(createJwtVerifyResult());

    delete data.expiresIn;
    delete data.expiresOn;

    const result = await parseTokenData(aegis, data, { defaultTokenExpiry: "2h" });
    expect(result).toMatchSnapshot();
  });
});
