import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserSession } from "../../fixtures/entity";
import { getBrowserSessionCookies as _getBrowserSessionCookies } from "../cookies";
import { tryFindBrowserSessions } from "./try-find-browser-sessions";

jest.mock("../cookies");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;

describe("tryFindBrowserSessions", () => {
  let ctx: any;
  let idToken: any;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    idToken = {
      subject: "7a5e8320-2c42-4803-8a4d-231d75d62e02",
    };

    getBrowserSessionCookies.mockImplementation(() => [
      "847cd9f5-7ed6-4e4e-95a0-215303a95673",
      "e1bd6912-8ed9-499b-8a98-48873fc53b1b",
    ]);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve browser sessions", async () => {
    await expect(tryFindBrowserSessions(ctx)).resolves.toStrictEqual([
      expect.objectContaining({ id: "847cd9f5-7ed6-4e4e-95a0-215303a95673" }),
      expect.objectContaining({ id: "e1bd6912-8ed9-499b-8a98-48873fc53b1b" }),
    ]);

    expect(ctx.repository.browserSessionRepository.tryFind).toHaveBeenCalled();
  });

  test("should resolve filtered browser sessions", async () => {
    ctx.repository.browserSessionRepository.tryFind.mockResolvedValueOnce(
      createTestBrowserSession({
        id: "bd3d4afc-73bb-4839-b78c-6132cbb932b0",
        identityId: "7a5e8320-2c42-4803-8a4d-231d75d62e02",
      }),
    );

    await expect(tryFindBrowserSessions(ctx, idToken)).resolves.toStrictEqual([
      expect.objectContaining({
        id: "bd3d4afc-73bb-4839-b78c-6132cbb932b0",
        identityId: "7a5e8320-2c42-4803-8a4d-231d75d62e02",
      }),
    ]);

    expect(ctx.repository.browserSessionRepository.tryFind).toHaveBeenCalled();
  });

  test("should resolve empty array", async () => {
    getBrowserSessionCookies.mockImplementation(() => []);

    await expect(tryFindBrowserSessions(ctx)).resolves.toStrictEqual([]);

    expect(ctx.repository.browserSessionRepository.tryFind).not.toHaveBeenCalled();
  });
});
