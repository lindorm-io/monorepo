import { BrowserSession, Client, RefreshSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { tryFindRefreshSession } from "./try-find-refresh-session";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("tryFindRefreshSession", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;
  let idToken: any;

  beforeEach(() => {
    ctx = {
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    browserSession = createTestBrowserSession({
      id: "3cda020f-0b63-4570-99da-a3bce76b7771",
    });

    client = createTestClient({
      id: "df535455-a926-4541-9fcf-ccf75fc5bf0d",
    });

    idToken = {
      session: "bc9ebf6f-2c5b-47ba-875b-810f56122f75",
      sessionHint: "refresh",
    };
  });

  test("should resolve refresh session with id token", async () => {
    await expect(
      tryFindRefreshSession(ctx, client, browserSession, idToken),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.tryFind).toHaveBeenCalledWith({
      id: "bc9ebf6f-2c5b-47ba-875b-810f56122f75",
    });
  });

  test("should resolve refresh session without id token", async () => {
    await expect(tryFindRefreshSession(ctx, client, browserSession)).resolves.toStrictEqual(
      expect.any(RefreshSession),
    );

    expect(ctx.repository.refreshSessionRepository.tryFind).toHaveBeenCalledWith({
      browserSessionId: "3cda020f-0b63-4570-99da-a3bce76b7771",
      clientId: "df535455-a926-4541-9fcf-ccf75fc5bf0d",
    });
  });

  test("should resolve undefined", async () => {
    await expect(tryFindRefreshSession(ctx, client)).resolves.toBeUndefined();

    expect(ctx.repository.refreshSessionRepository.tryFind).not.toHaveBeenCalled();
  });
});
