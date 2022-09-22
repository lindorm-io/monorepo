import { BrowserSession, Client, ConsentSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { tryFindConsentSession } from "./try-find-consent-session";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../fixtures/entity";

describe("tryFindConsentSession", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      repository: {
        consentSessionRepository: createMockRepository(createTestConsentSession),
      },
    };

    browserSession = createTestBrowserSession({
      identityId: "972568e4-aa8d-41cb-a814-061ca7765f8b",
    });

    client = createTestClient({
      id: "4b5a1aab-9153-430c-bcf0-864180127b2a",
    });
  });

  test("should resolve consent session", async () => {
    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toStrictEqual(
      expect.any(ConsentSession),
    );

    expect(ctx.repository.consentSessionRepository.find).toHaveBeenCalled();
  });

  test("should resolve nothing when identity id is not set", async () => {
    browserSession = createTestBrowserSession({
      identityId: null,
    });

    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toBeUndefined();

    expect(ctx.repository.consentSessionRepository.find).not.toHaveBeenCalled();
  });

  test("should resolve nothing when session can not be found", async () => {
    ctx.repository.consentSessionRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toBeUndefined();
  });

  test("should throw on unexpected error", async () => {
    ctx.repository.consentSessionRepository.find.mockRejectedValue(new Error("test"));

    await expect(tryFindConsentSession(ctx, browserSession, client)).rejects.toThrow(Error);
  });
});
