import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestBrowserLink } from "../../fixtures/entity";
import { deleteBrowserLinkController } from "./delete-browser-link";
import { ClientError } from "@lindorm-io/errors";

describe("deleteBrowserLinkController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        browserLink: createTestBrowserLink({
          accountId: "9f875519-0da5-4681-9ce8-700a2d4fe0a4",
        }),
      },
      mongo: {
        browserLinkRepository: createMockMongoRepository(createTestBrowserLink),
      },
      token: {
        bearerToken: {
          subject: "9f875519-0da5-4681-9ce8-700a2d4fe0a4",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteBrowserLinkController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.browserLinkRepository.destroy).toHaveBeenCalled();
  });

  test("should throw", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(deleteBrowserLinkController(ctx)).rejects.toThrow(ClientError);
  });
});
