import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount, createTestBrowserLink } from "../../fixtures/entity";
import { destroyAccountCallback as _destroyAccountCallback } from "../../handler";
import { rtbfController } from "./rtbf";

jest.mock("../../handler");

const destroyAccountCallback = _destroyAccountCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount(),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
        browserLinkRepository: createMockMongoRepository(createTestBrowserLink),
      },
    };

    destroyAccountCallback.mockReturnValue("destroyAccountCallback");
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.accountRepository.destroy).toHaveBeenCalled();
    expect(ctx.mongo.browserLinkRepository.deleteMany).toHaveBeenCalled();
  });
});
