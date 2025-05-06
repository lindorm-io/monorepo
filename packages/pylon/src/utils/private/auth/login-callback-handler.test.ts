import { ClientError } from "@lindorm/errors";
import { getAuthClient as _getAuthClient } from "./get-auth-client";
import { createLoginCallbackHandler } from "./login-callback-handler";
import { parseTokenData as _parseTokenData } from "./parse-token-data";

jest.mock("@lindorm/aegis", () => ({
  Aegis: class Aegis {
    static parse() {
      return { payload: { nonce: "nonce" } };
    }
  },
}));

jest.mock("./get-auth-client");
jest.mock("./parse-token-data");

const getAuthClient = _getAuthClient as jest.Mock;
const parseTokenData = _parseTokenData as jest.Mock;

describe("createLoginCallbackHandler", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      cookies: {
        login: "login_cookie",
      },
      defaults: {
        audience: "audience",
      },
    };

    ctx = {
      cookies: {
        get: jest.fn().mockResolvedValue({
          codeChallengeMethod: "codeChallengeMethod",
          codeVerifier: "codeVerifier",
          nonce: "nonce",
          redirectUri: "redirectUri",
          responseType: "code",
          scope: "scope",
          state: "state",
        }),
        set: jest.fn(),
        del: jest.fn(),
      },
      data: {
        state: "state",
        code: "code",
      },
      redirect: jest.fn(),
      request: {
        origin: "http://localhost",
      },
      session: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      state: {},
    };

    getAuthClient.mockReturnValue({
      token: jest.fn(),
      userinfo: jest.fn().mockResolvedValue({
        sub: "sub",
      }),
    });
    parseTokenData.mockReturnValue({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve with code", async () => {
    await expect(
      createLoginCallbackHandler(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(getAuthClient).toHaveBeenCalled();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should resolve with token", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "nonce",
      redirectUri: "redirectUri",
      responseType: "token",
      scope: "scope",
      state: "state",
    });

    await expect(
      createLoginCallbackHandler(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(getAuthClient).not.toHaveBeenCalled();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should resolve with userinfo", async () => {
    parseTokenData.mockReturnValue({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: null,
    });

    await expect(
      createLoginCallbackHandler(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "sub",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should throw on invalid state", async () => {
    ctx.data.state = "wrong";

    await expect(createLoginCallbackHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on missing session", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "nonce",
      redirectUri: "redirectUri",
      responseType: "wrong",
      scope: "scope",
      state: "state",
    });

    await expect(createLoginCallbackHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid nonce", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "invalid_nonce",
      redirectUri: "redirectUri",
      responseType: "wrong",
      scope: "scope",
      state: "state",
    });

    await expect(createLoginCallbackHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
