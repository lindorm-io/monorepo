import { BrowserSession, Client, AccessSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { tryFindAccessSession } from "./try-find-access-session";
import {
  createTestBrowserSession,
  createTestClient,
  createTestAccessSession,
} from "../../fixtures/entity";

describe("tryFindAccessSession", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;
  let idToken: any;

  beforeEach(() => {
    ctx = {
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
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
      sessionHint: "access",
    };
  });

  test("should resolve access session with id token", async () => {
    await expect(tryFindAccessSession(ctx, client, browserSession, idToken)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.tryFind).toHaveBeenCalledWith({
      id: "bc9ebf6f-2c5b-47ba-875b-810f56122f75",
    });
  });

  test("should resolve access session without id token", async () => {
    await expect(tryFindAccessSession(ctx, client, browserSession)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.tryFind).toHaveBeenCalledWith({
      browserSessionId: "3cda020f-0b63-4570-99da-a3bce76b7771",
      clientId: "df535455-a926-4541-9fcf-ccf75fc5bf0d",
    });
  });

  test("should resolve undefined", async () => {
    await expect(tryFindAccessSession(ctx, client)).resolves.toBeUndefined();

    expect(ctx.repository.accessSessionRepository.tryFind).not.toHaveBeenCalled();
  });
});
