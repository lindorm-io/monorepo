import { Client } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleConsentSessionOnLogout } from "./handle-consent-session-on-logout";
import {
  getTestBrowserSession,
  getTestClient,
  getTestConsentSession,
  getTestRefreshSession,
} from "../../test/entity";

describe("handleConsentSessionOnLogout", () => {
  let ctx: any;
  let client: Client;

  beforeEach(() => {
    ctx = {
      repository: {
        consentSessionRepository: createMockRepository((options) =>
          getTestConsentSession({
            sessions: [
              "1a6e07af-6f12-4e0f-b590-d4c1f5ab8c73",
              "215fead5-b07c-4ccf-b54a-e7bf419427e6",
            ],
            ...options,
          }),
        ),
      },
    };

    client = getTestClient();
  });

  test("should resolve with updated consent session for browser session", async () => {
    await expect(
      handleConsentSessionOnLogout(
        ctx,
        client,
        getTestBrowserSession({
          id: "1a6e07af-6f12-4e0f-b590-d4c1f5ab8c73",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalled();
  });

  test("should resolve with updated consent session for refresh session", async () => {
    await expect(
      handleConsentSessionOnLogout(
        ctx,
        client,
        getTestRefreshSession({
          id: "1a6e07af-6f12-4e0f-b590-d4c1f5ab8c73",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalled();
  });

  test("should resolve with destroyed consent session", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      getTestConsentSession({
        sessions: ["1a6e07af-6f12-4e0f-b590-d4c1f5ab8c73"],
      }),
    );

    await expect(
      handleConsentSessionOnLogout(
        ctx,
        client,
        getTestBrowserSession({
          id: "1a6e07af-6f12-4e0f-b590-d4c1f5ab8c73",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.consentSessionRepository.destroy).toHaveBeenCalled();
  });
});
