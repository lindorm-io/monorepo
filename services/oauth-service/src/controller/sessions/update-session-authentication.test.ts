import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionHint } from "../../enum";
import { updateSessionAuthenticationController } from "./update-session-authentication";
import {
  updateBrowserSessionAuthentication as _updateBrowserSessionAuthentication,
  updateRefreshSessionAuthentication as _updateRefreshSessionAuthentication,
} from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const updateBrowserSessionAuthentication = _updateBrowserSessionAuthentication as jest.Mock;
const updateRefreshSessionAuthentication = _updateRefreshSessionAuthentication as jest.Mock;

describe("updateSessionAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      token: {
        authenticationConfirmationToken: {},
        bearerToken: {
          sessionId: "de1d76b2-09bd-4f1b-ad97-917e704c3532",
          sessionHint: null,
        },
      },
    };
  });

  test("should resolve browser session update", async () => {
    ctx.token.bearerToken.sessionHint = SessionHint.BROWSER;

    await expect(updateSessionAuthenticationController(ctx)).resolves.toBeUndefined();

    expect(updateBrowserSessionAuthentication).toHaveBeenCalled();
  });

  test("should resolve refresh session update", async () => {
    ctx.token.bearerToken.sessionHint = SessionHint.REFRESH;

    await expect(updateSessionAuthenticationController(ctx)).resolves.toBeUndefined();

    expect(updateRefreshSessionAuthentication).toHaveBeenCalled();
  });

  test("should throw on invalid session hint", async () => {
    ctx.token.bearerToken.sessionHint = "wrong";

    await expect(updateSessionAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
