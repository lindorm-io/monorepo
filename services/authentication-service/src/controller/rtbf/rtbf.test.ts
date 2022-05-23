import { getTestAccount } from "../../test/entity";
import { rtbfController } from "./rtbf";
import { destroyAccountCallback as _destroyAccountCallback } from "../../handler";

jest.mock("../../handler");

const destroyAccountCallback = _destroyAccountCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: { account: getTestAccount() },
      repository: {
        accountRepository: {
          destroy: jest.fn(),
        },
      },
    };

    destroyAccountCallback.mockImplementation(() => "destroyAccountCallback");
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.accountRepository.destroy).toHaveBeenCalled();
  });
});
