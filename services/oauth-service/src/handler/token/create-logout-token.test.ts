import { ClientSessionType } from "../../enum";
import { createTestClient, createTestClientSession } from "../../fixtures/entity";
import { createLogoutToken } from "./create-logout-token";

describe("createLogoutToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockReturnValue("signed"),
      },
    };
  });

  test("should create logout token", () => {
    expect(
      createLogoutToken(
        ctx,
        createTestClient(),
        createTestClientSession({ type: ClientSessionType.EPHEMERAL }),
      ),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "ephemeral",
      }),
    );
  });

  test("should create logout token", () => {
    expect(createLogoutToken(ctx, createTestClient(), createTestClientSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
      }),
    );
  });
});
