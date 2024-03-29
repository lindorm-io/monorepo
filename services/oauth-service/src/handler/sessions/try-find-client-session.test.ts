import { createMockMongoRepository } from "@lindorm-io/mongo";
import { BrowserSession, Client, ClientSession } from "../../entity";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { tryFindClientSession } from "./try-find-client-session";

describe("tryFindClientSession", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;
  let idToken: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    browserSession = createTestBrowserSession({
      id: "3cda020f-0b63-4570-99da-a3bce76b7771",
    });

    client = createTestClient({
      id: "df535455-a926-4541-9fcf-ccf75fc5bf0d",
    });

    idToken = {
      metadata: { session: "bc9ebf6f-2c5b-47ba-875b-810f56122f75" },
    };
  });

  test("should resolve client session with id token", async () => {
    await expect(tryFindClientSession(ctx, client, browserSession, idToken)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.tryFind).toHaveBeenCalledWith({
      id: "bc9ebf6f-2c5b-47ba-875b-810f56122f75",
    });
  });

  test("should resolve client session without id token", async () => {
    await expect(tryFindClientSession(ctx, client, browserSession)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.tryFind).toHaveBeenCalledWith({
      browserSessionId: "3cda020f-0b63-4570-99da-a3bce76b7771",
      clientId: "df535455-a926-4541-9fcf-ccf75fc5bf0d",
    });
  });

  test("should resolve undefined", async () => {
    await expect(tryFindClientSession(ctx, client)).resolves.toBeUndefined();

    expect(ctx.mongo.clientSessionRepository.tryFind).not.toHaveBeenCalled();
  });
});
