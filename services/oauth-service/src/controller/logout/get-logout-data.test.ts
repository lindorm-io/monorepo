import MockDate from "mockdate";
import { getLogoutDataController } from "./get-logout-data";
import { createTestClient, createTestLogoutSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getLogoutInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
        logoutSession: createTestLogoutSession({
          id: "09e75ed3-751f-44f8-82ac-bc797250a793",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getLogoutDataController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          description: "Client description",
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          type: "confidential",
        },
        logoutSession: {
          id: "09e75ed3-751f-44f8-82ac-bc797250a793",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          originalUri: "https://localhost/oauth2/sessions/logout?query=query",
        },
        logoutStatus: "pending",
      },
    });
  });
});
