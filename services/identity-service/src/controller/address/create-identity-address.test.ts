import { createIdentityAddressController } from "./create-identity-address";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";

describe("createIdentityAddressController", () => {
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
      repository: {
        addressRepository: createMockRepository(createTestAddress),
      },
    };
  });

  test("should resolve", async () => {
    await expect(createIdentityAddressController(ctx)).resolves.toStrictEqual({
      body: { addressId: expect.any(String) },
      status: 201,
    });

    expect(ctx.repository.addressRepository.create).toHaveBeenCalled();
  });
});
