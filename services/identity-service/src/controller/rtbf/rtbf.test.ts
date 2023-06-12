import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import { rtbfController } from "./rtbf";

jest.mock("../../handler");

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity({
          displayName: {
            name: "name",
            number: 1234,
          },
        }),
      },
      mongo: {
        addressRepository: createMockMongoRepository(),
        identifierRepository: createMockMongoRepository(),
        identityRepository: createMockMongoRepository(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.addressRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.mongo.identifierRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.mongo.identityRepository.destroy).toHaveBeenCalled();
  });
});
