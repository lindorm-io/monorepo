import { ClientError } from "@lindorm/errors";
import { identityHandler } from "./identity-handler";

describe("identityHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      aegis: {
        verify: jest.fn().mockResolvedValue({
          header: { baseFormat: "JWT" },
          payload: {
            claims: {
              username: "username",
            },
            sub: "sub",
            iss: "iss",
            aud: "aud",
            exp: 1234567890,
          },
        }),
      },
      state: {
        session: {
          idToken: "idToken",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(identityHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      username: "username",
      sub: "sub",
      iss: "iss",
      aud: "aud",
      exp: 1234567890,
    });
    expect(ctx.status).toEqual(200);
  });

  test("should throw on missing session", async () => {
    ctx.state.session = undefined;

    await expect(identityHandler(ctx, jest.fn())).rejects.toThrow(ClientError);
  });

  test("should throw on missing id token", async () => {
    ctx.state.session = {};

    await expect(identityHandler(ctx, jest.fn())).rejects.toThrow(ClientError);
  });

  test("should throw when verified token is not jwt kind", async () => {
    ctx.aegis.verify.mockResolvedValue({ decoded: {}, header: { baseFormat: "JWS" } });

    await expect(identityHandler(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
