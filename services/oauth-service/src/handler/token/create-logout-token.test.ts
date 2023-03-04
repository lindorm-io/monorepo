import { createLogoutToken } from "./create-logout-token";
import { createTestClient, createTestClientSession } from "../../fixtures/entity";
import { ClientSessionType } from "../../enum";

describe("createLogoutToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
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
