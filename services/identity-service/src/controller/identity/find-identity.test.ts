import { IdentifierType } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import { findIdentityWithIdentifier as _findIdentityWithIdentifier } from "../../handler";
import { findIdentityController } from "./find-identity";

jest.mock("../../handler");

const findIdentityWithIdentifier = _findIdentityWithIdentifier as jest.Mock;

describe("findIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        email: undefined,
        external: undefined,
        provider: undefined,
        nin: undefined,
        phone: undefined,
        ssn: undefined,
        username: undefined,
      },
      mongo: {
        identityRepository: createMockMongoRepository((opts) =>
          createTestIdentity({ ...opts, id: "7e55ab40-8341-40f2-98d3-66a9f9d0389f" }),
        ),
      },
    };

    findIdentityWithIdentifier.mockResolvedValue(
      createTestIdentity({ id: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0" }),
    );
  });

  afterEach(jest.resetAllMocks);

  test("should resolve null", async () => {
    ctx.data.email = "email";

    findIdentityWithIdentifier.mockResolvedValue(undefined);

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: { identityId: null },
    });
  });

  test("should resolve email", async () => {
    ctx.data.email = "email";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
    });

    expect(findIdentityWithIdentifier).toHaveBeenCalledWith(ctx, {
      type: IdentifierType.EMAIL,
      value: "email",
    });
  });

  test("should resolve phone", async () => {
    ctx.data.phone = "phone";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
    });

    expect(findIdentityWithIdentifier).toHaveBeenCalledWith(ctx, {
      type: IdentifierType.PHONE,
      value: "phone",
    });
  });

  test("should resolve nin", async () => {
    ctx.data.nin = "nin";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
    });

    expect(findIdentityWithIdentifier).toHaveBeenCalledWith(ctx, {
      type: IdentifierType.NIN,
      value: "nin",
    });
  });

  test("should resolve ssn", async () => {
    ctx.data.ssn = "ssn";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
    });

    expect(findIdentityWithIdentifier).toHaveBeenCalledWith(ctx, {
      type: IdentifierType.SSN,
      value: "ssn",
    });
  });

  test("should resolve external", async () => {
    ctx.data.external = "external";
    ctx.data.provider = "provider";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
    });

    expect(findIdentityWithIdentifier).toHaveBeenCalledWith(ctx, {
      type: IdentifierType.EXTERNAL,
      provider: "provider",
      value: "external",
    });
  });

  test("should resolve username", async () => {
    ctx.data.username = "username";

    await expect(findIdentityController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "7e55ab40-8341-40f2-98d3-66a9f9d0389f",
      },
    });

    expect(ctx.mongo.identityRepository.tryFind).toHaveBeenCalledWith({
      username: "username",
    });
  });

  test("should throw on missing params", async () => {
    await expect(findIdentityController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on too many params", async () => {
    ctx.data.email = "e";
    ctx.data.phone = "p";

    await expect(findIdentityController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid params", async () => {
    ctx.data.external = "e";

    await expect(findIdentityController(ctx)).rejects.toThrow(ClientError);
  });
});
