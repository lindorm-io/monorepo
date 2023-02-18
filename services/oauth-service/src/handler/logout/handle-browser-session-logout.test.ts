import { LogoutSession } from "../../entity";
import { createLogoutToken as _createLogoutToken } from "../token";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleBrowserSessionLogout } from "./handle-browser-session-logout";
import { tryFindBrowserSessions as _tryFindBrowserSessions } from "../sessions";
import { setBrowserSessionCookies as _setBrowserSessionCookies } from "../cookies";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestLogoutSession,
} from "../../fixtures/entity";

jest.mock("../cookies");
jest.mock("../sessions");
jest.mock("../token");

const setBrowserSessionCookies = _setBrowserSessionCookies as jest.Mock;
const createLogoutToken = _createLogoutToken as jest.Mock;
const tryFindBrowserSessions = _tryFindBrowserSessions as jest.Mock;

describe("handleBrowserSessionLogout", () => {
  let ctx: any;
  let logoutSession: LogoutSession;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn(),
        },
      },
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    logoutSession = createTestLogoutSession({
      confirmedLogout: {
        accessSessionId: null,
        browserSessionId: "44c2d3db-befd-4a16-9abc-894e4203c99b",
        refreshSessionId: null,
      },
    });

    tryFindBrowserSessions.mockResolvedValue([
      createTestBrowserSession({ id: "3d57bd92-c9bf-4b14-a1bd-e16419775883" }),
      createTestBrowserSession({ id: "44c2d3db-befd-4a16-9abc-894e4203c99b" }),
    ]);
    setBrowserSessionCookies.mockImplementation();
    createLogoutToken.mockImplementation(() => ({ token: "logout.jwt.jwt" }));
  });

  test("should resolve", async () => {
    ctx.repository.accessSessionRepository.findMany.mockResolvedValue([
      createTestAccessSession(),
      createTestAccessSession(),
      createTestAccessSession(),
    ]);

    await expect(handleBrowserSessionLogout(ctx, logoutSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(3);
    expect(setBrowserSessionCookies).toHaveBeenCalledWith(ctx, [
      "3d57bd92-c9bf-4b14-a1bd-e16419775883",
    ]);
  });
});
