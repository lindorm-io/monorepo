import MockDate from "mockdate";
import { tokeninfoController } from "./tokeninfo";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createTestClient, createTestInvalidToken } from "../../fixtures/entity";
import { TokenError } from "@lindorm-io/jwt";

MockDate.set("2021-01-01T08:00:00.000Z");

const decode = jest.fn();

jest.mock("@lindorm-io/jwt", () => ({
  ...(jest.requireActual("@lindorm-io/jwt") as object),
  JWT: {
    decodeFormatted: (...args: any) => decode(args),
  },
}));

describe("tokeninfoController", () => {
  let ctx: any;

  beforeEach(() => {
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
        token: "token",
        tokenTypeHint: "hint",
      },
      jwt: {
        verify: jest.fn(),
      },
    };

    decode.mockImplementation(() => ({
      id: "id",
      active: true,
      adjustedAccessLevel: 2,
      audiences: "audiences",
      authContextClass: ["acr1"],
      authMethodsReference: ["amr1"],
      expires: "expires",
      issuedAt: "issuedAt",
      issuer: "issuer",
      levelOfAssurance: 2,
      notBefore: "notBefore",
      scopes: "scopes",
      sessionId: "sessionId",
      subject: "subject",
      type: "type",
      username: "username",
    }));
  });

  test("should resolve token info", async () => {
    await expect(tokeninfoController(ctx)).resolves.toMatchSnapshot();

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
