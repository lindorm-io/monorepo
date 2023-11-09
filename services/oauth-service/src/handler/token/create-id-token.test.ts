import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
} from "@lindorm-io/common-enums";
import { createTestClient, createTestClientSession } from "../../fixtures/entity";
import { createIdToken } from "./create-id-token";

describe("createIdToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockReturnValue("signed"),
      },
    };
  });

  test("should create id token for client session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestClientSession(), {
        email: "test@lindorm.io",
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith({
      accessToken: undefined,
      audiences: [expect.any(String)],
      authContextClass: AuthenticationLevel.LOA_2,
      authFactorReference: AuthenticationFactor.TWO_FACTOR,
      authMethodsReference: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      authTime: 1609487940,
      authorizedParty: expect.any(String),
      claims: {
        email: "test@lindorm.io",
      },
      client: expect.any(String),
      code: expect.any(String),
      expiry: expect.any(Date),
      levelOfAssurance: 2,
      nonce: expect.any(String),
      scopes: ["openid", "profile"],
      session: expect.any(String),
      sessionHint: "refresh",
      subject: expect.any(String),
      subjectHint: "identity",
      tenant: expect.any(String),
      type: "id_token",
    });
  });

  test("should create id token with access token", async () => {
    await expect(
      createIdToken(
        ctx,
        createTestClient(),
        createTestClientSession(),
        { email: "test@lindorm.io" },
        "accessToken",
      ),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith({
      accessToken: "accessToken",
      audiences: [expect.any(String)],
      authContextClass: AuthenticationLevel.LOA_2,
      authFactorReference: AuthenticationFactor.TWO_FACTOR,
      authMethodsReference: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      authTime: 1609487940,
      authorizedParty: expect.any(String),
      claims: {
        email: "test@lindorm.io",
      },
      client: expect.any(String),
      code: expect.any(String),
      expiry: expect.any(Date),
      levelOfAssurance: 2,
      nonce: expect.any(String),
      scopes: ["openid", "profile"],
      session: expect.any(String),
      sessionHint: "refresh",
      subject: expect.any(String),
      subjectHint: "identity",
      tenant: expect.any(String),
      type: "id_token",
    });
  });

  test("should resolve with expires from client session", async () => {
    await expect(
      createIdToken(
        ctx,
        createTestClient(),
        createTestClientSession({
          expires: new Date("2021-01-01T08:00:10.000Z"),
        }),
        { email: "test@lindorm.io" },
        "accessToken",
      ),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith({
      accessToken: "accessToken",
      audiences: [expect.any(String)],
      authContextClass: AuthenticationLevel.LOA_2,
      authFactorReference: AuthenticationFactor.TWO_FACTOR,
      authMethodsReference: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      authTime: 1609487940,
      authorizedParty: expect.any(String),
      claims: {
        email: "test@lindorm.io",
      },
      client: expect.any(String),
      code: expect.any(String),
      expiry: new Date("2021-01-01T08:00:10.000Z"),
      levelOfAssurance: 2,
      nonce: expect.any(String),
      scopes: ["openid", "profile"],
      session: expect.any(String),
      sessionHint: "refresh",
      subject: expect.any(String),
      subjectHint: "identity",
      tenant: expect.any(String),
      type: "id_token",
    });
  });
});
