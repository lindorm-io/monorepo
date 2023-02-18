import MockDate from "mockdate";
import { tokeninfoController } from "./tokeninfo";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createTestClient, createTestInvalidToken } from "../../fixtures/entity";
import { createTestJwt, TokenError } from "@lindorm-io/jwt";
import { expiryDate } from "@lindorm-io/expiry";
import { getUnixTime } from "date-fns";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("tokeninfoController", () => {
  const jwt = createTestJwt();
  let ctx: any;

  beforeEach(() => {
    const { token } = jwt.sign({
      id: "554595af-99b6-4f68-b0bf-9138fc54b7d1",
      adjustedAccessLevel: 2,
      audiences: ["455118ba-d8f1-4a0a-affa-a53235590dba"],
      authContextClass: ["loa_2"],
      authMethodsReference: ["email", "phone"],
      authTime: getUnixTime(new Date()),
      authorizedParty: "e8f55cef-4244-45f4-a7d6-da69b208bed8",
      claims: { claim: 1 },
      client: "455118ba-d8f1-4a0a-affa-a53235590dba",
      expiry: expiryDate("5 days"),
      levelOfAssurance: 2,
      nonce: "IpoPcFc9nWdB4hfZ",
      payload: { payload: true },
      scopes: ["scopes"],
      session: "74b21503-c8aa-4e7d-90d3-1cf70e3ce02c",
      sessionHint: "session-hint",
      subject: "18568521-7771-482a-9c4b-1091054f3dc3",
      subjectHint: "subject-hint",
      tenant: "27b0adb8-cbc0-4232-8bc0-c50a9e63501f",
      type: "token_type",
      username: "username",
    });

    ctx = {
      cache: {
        invalidTokenCache: {
          find: jest.fn().mockRejectedValue(new EntityNotFoundError("test")),
        },
      },
      entity: {
        client: createTestClient({
          id: "455118ba-d8f1-4a0a-affa-a53235590dba",
        }),
      },
      data: {
        token,
        tokenTypeHint: "token_type",
      },
      jwt: {
        verify: jest.fn().mockImplementation((t, o) => jwt.verify(t, o)),
      },
    };
  });

  test("should resolve token info", async () => {
    await expect(tokeninfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        aal: 2,
        acr: ["loa_2"],
        amr: ["email", "phone"],
        aud: ["455118ba-d8f1-4a0a-affa-a53235590dba"],
        authTime: 1609488000,
        azp: "e8f55cef-4244-45f4-a7d6-da69b208bed8",
        clientId: "455118ba-d8f1-4a0a-affa-a53235590dba",
        exp: 1609920000,
        iat: 1609488000,
        iss: "https://test.lindorm.io",
        jti: "554595af-99b6-4f68-b0bf-9138fc54b7d1",
        loa: 2,
        nbf: 1609488000,
        scope: ["scopes"],
        sid: "74b21503-c8aa-4e7d-90d3-1cf70e3ce02c",
        sub: "18568521-7771-482a-9c4b-1091054f3dc3",
        tid: "27b0adb8-cbc0-4232-8bc0-c50a9e63501f",
        tokenType: "token_type",
        username: "username",
      },
    });

    expect(ctx.jwt.verify).toHaveBeenCalled();
  });

  test("should resolve inactive if verify fails", async () => {
    ctx.jwt.verify.mockImplementation(() => {
      throw new TokenError("test");
    });

    await expect(tokeninfoController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        active: false,
      }),
    });
  });

  test("should resolve inactive if token id is invalid", async () => {
    ctx.cache.invalidTokenCache.find.mockResolvedValue(createTestInvalidToken());

    await expect(tokeninfoController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        active: false,
      }),
    });
  });
});
