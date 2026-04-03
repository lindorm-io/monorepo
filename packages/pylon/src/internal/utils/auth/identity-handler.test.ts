import { ClientError } from "@lindorm/errors";
import { identityHandler } from "./identity-handler";

jest.mock("@lindorm/aegis", () => ({
  Aegis: class Aegis {
    static parse() {
      return {
        payload: {
          claims: {
            username: "username",
          },
          sub: "sub",
          iss: "iss",
          aud: "aud",
          exp: 1234567890,
        },
      };
    }
  },
}));

describe("identityHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
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
});
