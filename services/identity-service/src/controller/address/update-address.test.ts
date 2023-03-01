import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import { updateAddressController } from "./update-address";

describe("updateAddressController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        careOf: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postalCode: "postalCode",
        region: "region",
        streetAddress: ["streetAddress"],
      },
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
    await expect(updateAddressController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.addressRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        careOf: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postalCode: "postalCode",
        region: "region",
        streetAddress: ["streetAddress"],
      }),
    );
  });
});
