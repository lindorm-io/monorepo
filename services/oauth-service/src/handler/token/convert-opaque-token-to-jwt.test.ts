import { ClientSessionType } from "../../enum";
import {
  createTestAccessToken,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { convertOpaqueTokenToJwt } from "./convert-opaque-token-to-jwt";

describe("createOpaqueJwt", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockReturnValue("signed"),
      },
    };
  });

  test("should create access token", () => {
    expect(
      convertOpaqueTokenToJwt(
        ctx,
        createTestClientSession({ type: ClientSessionType.EPHEMERAL }),
        createTestAccessToken(),
      ),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "ephemeral",
        type: "access_token",
      }),
    );
  });

  test("should create refresh token", () => {
    expect(convertOpaqueTokenToJwt(ctx, createTestClientSession(), createTestRefreshToken())).toBe(
      "signed",
    );

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
        type: "refresh_token",
      }),
    );
  });
});
