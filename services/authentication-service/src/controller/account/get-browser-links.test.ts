import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserLink } from "../../fixtures/entity";
import { getBrowserLinksController } from "./get-browser-links";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),

  randomUUID: jest.fn().mockImplementation(() => "a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

describe("getBrowserLinksController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        browserLinkRepository: createMockRepository(createTestBrowserLink),
      },
      token: {
        bearerToken: { subject: "accountId" },
      },
    };
  });

  test("should resolve", async () => {
    await expect(getBrowserLinksController(ctx)).resolves.toStrictEqual({
      body: {
        browserLinks: [
          {
            id: "a26dad28-e854-447d-bce6-5c685cddfea8",
            browser: "browser",
            created: new Date("2021-01-01T08:00:00.000Z"),
            environment: "test",
            os: "os",
            platform: "platform",
          },
        ],
      },
    });
  });
});
