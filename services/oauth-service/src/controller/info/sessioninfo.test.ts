import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { sessioninfoController } from "./sessioninfo";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("sessioninfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve", async () => {
    await expect(sessioninfoController(ctx)).resolves.toStrictEqual({
      body: {
        accessSessions: [
          {
            id: expect.any(String),
            clientId: expect.any(String),
            latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
            levelOfAssurance: 2,
            scopes: ["openid", "profile"],
          },
        ],
        browserSessions: [
          {
            id: expect.any(String),
            latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
            levelOfAssurance: 2,
            remember: true,
          },
        ],
        clients: [
          {
            id: expect.any(String),
            description: "Client description",
            name: "ClientName",
          },
          {
            id: expect.any(String),
            description: "Client description",
            name: "ClientName",
          },
        ],
        refreshSessions: [
          {
            id: expect.any(String),
            clientId: expect.any(String),
            expires: new Date("2021-02-01T08:00:00.000Z"),
            latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
            levelOfAssurance: 2,
            scopes: ["openid", "profile"],
          },
        ],
      },
    });
  });
});
