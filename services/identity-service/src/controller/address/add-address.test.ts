import { addAddressController } from "./add-address";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";

describe("addAddressController", () => {
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
        identity: createTestIdentity(),
      },
      mongo: {
        addressRepository: createMockMongoRepository(createTestAddress),
      },
    };
  });

  test("should resolve", async () => {
    await expect(addAddressController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.addressRepository.create).toHaveBeenCalled();
  });
});
