import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestBrowserLink } from "../../fixtures/entity";
import { getBrowserLinksController } from "./get-browser-links";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),

  randomUUID: jest.fn().mockReturnValue("a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

describe("getBrowserLinksController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        browserLinkRepository: createMockMongoRepository(createTestBrowserLink),
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
            os: "os",
            platform: "platform",
          },
        ],
      },
    });
  });
});
