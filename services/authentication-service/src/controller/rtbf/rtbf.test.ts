import { createTestAccount } from "../../fixtures/entity";
import { rtbfController } from "./rtbf";
import { destroyAccountCallback as _destroyAccountCallback } from "../../handler";
import { createMockRepository } from "@lindorm-io/mongo";

jest.mock("../../handler");

const destroyAccountCallback = _destroyAccountCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount(),
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    destroyAccountCallback.mockImplementation(() => "destroyAccountCallback");
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.accountRepository.destroy).toHaveBeenCalled();
  });
});
