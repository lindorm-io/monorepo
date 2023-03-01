import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import { deleteAddressController } from "./delete-address";

describe("deleteAddressController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        address: createTestAddress({ identityId: "e4c33777-ecd3-476e-9ec5-3cc27f88b1f5" }),
        identity: createTestIdentity({ id: "e4c33777-ecd3-476e-9ec5-3cc27f88b1f5" }),
      },
      repository: {
        addressRepository: createMockRepository(createTestAddress),
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteAddressController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.addressRepository.destroy).toHaveBeenCalled();
  });
});
