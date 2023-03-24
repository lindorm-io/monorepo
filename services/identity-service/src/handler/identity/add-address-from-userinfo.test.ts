import { Address, Identity } from "../../entity";
import { addAddressFromUserinfo } from "./add-address-from-userinfo";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";

describe("addAddressFromUserinfo", () => {
  let ctx: any;
  let identity: Identity;
  let options: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        addressRepository: createMockMongoRepository(createTestAddress),
      },
    };

    identity = createTestIdentity();

    options = {
      country: "Country",
      locality: "Locality",
      postalCode: "234567",
      region: "Region",
      streetAddress: "Street Address 12",
    };
  });

  afterEach(jest.resetAllMocks);

  test("should resolve with new address", async () => {
    await expect(addAddressFromUserinfo(ctx, identity, options)).resolves.toStrictEqual(
      expect.any(Address),
    );

    expect(ctx.mongo.addressRepository.create).toHaveBeenCalled();
  });

  test("should resolve with new primary address", async () => {
    ctx.mongo.addressRepository.findMany.mockResolvedValue([]);

    await expect(addAddressFromUserinfo(ctx, identity, options)).resolves.toStrictEqual(
      expect.any(Address),
    );

    expect(ctx.mongo.addressRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        primary: true,
      }),
    );
  });

  test("should resolve with existing address", async () => {
    ctx.mongo.addressRepository.findMany.mockResolvedValue([
      createTestAddress({
        country: "Country",
        locality: "Locality",
        postalCode: "234567",
        region: "Region",
        streetAddress: ["Street Address 12"],
      }),
    ]);

    await expect(addAddressFromUserinfo(ctx, identity, options)).resolves.toStrictEqual(
      expect.any(Address),
    );

    expect(ctx.mongo.addressRepository.create).not.toHaveBeenCalled();
  });
});
