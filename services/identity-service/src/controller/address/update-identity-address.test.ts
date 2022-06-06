import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress } from "../../fixtures/entity";
import { updateIdentityAddressController } from "./update-identity-address";

describe("updateIdentityAddressController", () => {
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
        address: createTestAddress(),
      },
      repository: {
        addressRepository: createMockRepository(createTestAddress),
      },
    };
  });

  test("should resolve", async () => {
    await expect(updateIdentityAddressController(ctx)).resolves.toBeUndefined();

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
