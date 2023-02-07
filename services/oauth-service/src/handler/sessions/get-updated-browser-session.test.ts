import MockDate from "mockdate";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getUpdatedBrowserSession } from "./get-updated-browser-session";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getUpdatedBrowserSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository((opts) =>
          createTestBrowserSession({
            id: "5fd78d23-8d79-4135-85c8-11d34040b33c",
            identityId: "7a658184-a059-478d-a003-9a50c411ef64",
            latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
            remember: false,
            ...opts,
          }),
        ),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      confirmedLogin: {
        acrValues: ["loa_3"],
        amrValues: ["email", "phone", "session_link"],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        remember: true,
      },
      identifiers: {
        browserSessionId: "5fd78d23-8d79-4135-85c8-11d34040b33c",
        consentSessionId: null,
        refreshSessionId: null,
      },
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve created browser session on missing identifier", async () => {
    authorizationSession.identifiers.browserSessionId = null;

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.repository.browserSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["email", "phone", "session_link"],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        expires: new Date("2021-01-31T08:00:00.000Z"),
        remember: true,
      }),
    );
  });

  test("should resolve skipped browser session", async () => {
    authorizationSession.status.login = "skip";

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_2"],
        amrValues: ["email", "phone"],
        latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
        levelOfAssurance: 2,
        expires: new Date("2021-01-02T04:00:00.000Z"),
      }),
    );
  });

  test("should resolve created browser session on mismatched identity", async () => {
    authorizationSession.confirmedLogin.identityId = "166bbad4-7e02-4c46-83fb-e9327155fad8";

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.repository.browserSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["email", "phone", "session_link"],
        identityId: "166bbad4-7e02-4c46-83fb-e9327155fad8",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        expires: new Date("2021-01-31T08:00:00.000Z"),
        remember: true,
      }),
    );
  });

  test("should resolve updated browser session", async () => {
    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["email", "phone", "session_link"],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        expires: new Date("2021-01-31T08:00:00.000Z"),
        remember: true,
      }),
    );
  });

  test("should throw on invalid confirmation data", async () => {
    authorizationSession.confirmedLogin.acrValues = [];

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).rejects.toThrow(ServerError);
  });
});
