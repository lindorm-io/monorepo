import { BrowserSession, Client, ConsentSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { tryFindConsentSession } from "./try-find-consent-session";
import { getTestBrowserSession, getTestClient, getTestConsentSession } from "../../test/entity";
import { createMockRepository } from "@lindorm-io/mongo";

describe("tryFindConsentSession", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      repository: {
        consentSessionRepository: createMockRepository((options) => getTestConsentSession(options)),
      },
    };

    browserSession = getTestBrowserSession({
      identityId: "972568e4-aa8d-41cb-a814-061ca7765f8b",
    });

    client = getTestClient({
      id: "4b5a1aab-9153-430c-bcf0-864180127b2a",
    });
  });

  test("should resolve consent session", async () => {
    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toStrictEqual(
      expect.any(ConsentSession),
    );

    expect(ctx.repository.consentSessionRepository.findOrCreate).toHaveBeenCalled();
  });

  test("should resolve nothing when identity id is not set", async () => {
    browserSession = getTestBrowserSession({
      identityId: null,
    });

    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toBeUndefined();

    expect(ctx.repository.consentSessionRepository.findOrCreate).not.toHaveBeenCalled();
  });

  test("should resolve nothing when session can not be found", async () => {
    ctx.repository.consentSessionRepository.findOrCreate.mockRejectedValue(
      new EntityNotFoundError("test"),
    );

    await expect(tryFindConsentSession(ctx, browserSession, client)).resolves.toBeUndefined();
  });

  test("should throw on unexpected error", async () => {
    ctx.repository.consentSessionRepository.findOrCreate.mockRejectedValue(new Error("test"));

    await expect(tryFindConsentSession(ctx, browserSession, client)).rejects.toThrow(Error);
  });
});
