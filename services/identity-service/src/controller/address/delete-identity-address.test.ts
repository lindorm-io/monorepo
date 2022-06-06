import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress } from "../../fixtures/entity";
import { deleteIdentityAddressController } from "./delete-identity-address";
import { ClientError } from "@lindorm-io/errors";

describe("deleteIdentityAddressController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        address: createTestAddress({
          primary: false,
        }),
      },
      repository: {
        addressRepository: createMockRepository(createTestAddress),
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteIdentityAddressController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.addressRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on primary address", async () => {
    ctx.entity.address = createTestAddress({
      primary: true,
    });

    await expect(deleteIdentityAddressController(ctx)).rejects.toThrow(ClientError);
  });
});
