import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "@lindorm-io/common-types";
import { Identity } from "../../entity";
import { addGenericIdentifier } from "./add-generic-identifier";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";

describe("addGenericIdentifier", () => {
  let ctx: any;
  let identity: Identity;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();

    options = {
      label: "label",
      provider: "provider",
      type: IdentifierType.EMAIL,
      value: "new@lindorm.io",
      verified: true,
    };
  });

  test("should resolve without changes", async () => {
    ctx.repository.identifierRepository.tryFind.mockResolvedValueOnce(
      createTestEmailIdentifier({
        identityId: identity.id,
        verified: true,
        primary: true,
      }),
    );

    await expect(addGenericIdentifier(ctx, identity, options)).resolves.not.toThrow();

    expect(ctx.repository.identifierRepository.create).not.toHaveBeenCalled();
    expect(ctx.repository.identifierRepository.update).not.toHaveBeenCalled();
  });

  test("should resolve without primary", async () => {
    ctx.repository.identifierRepository.tryFind
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        createTestEmailIdentifier({
          identityId: identity.id,
          primary: true,
        }),
      );

    await expect(addGenericIdentifier(ctx, identity, options)).resolves.not.toThrow();

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: identity.id,
        label: "label",
        primary: false,
        provider: "provider",
        type: "email",
        value: "new@lindorm.io",
        verified: true,
      }),
    );

    expect(ctx.repository.identifierRepository.update).not.toHaveBeenCalled();
  });

  test("should resolve with primary", async () => {
    ctx.repository.identifierRepository.tryFind.mockResolvedValue(undefined);

    await expect(addGenericIdentifier(ctx, identity, options)).resolves.not.toThrow();

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: identity.id,
        label: "label",
        primary: true,
        provider: "provider",
        type: "email",
        value: "new@lindorm.io",
        verified: true,
      }),
    );

    expect(ctx.repository.identifierRepository.update).not.toHaveBeenCalled();
  });

  test("should resolve and replace previous verified", async () => {
    ctx.repository.identifierRepository.tryFind.mockResolvedValueOnce(
      createTestEmailIdentifier({
        primary: true,
      }),
    );

    await expect(addGenericIdentifier(ctx, identity, options)).resolves.not.toThrow();

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: identity.id,
        label: "label",
        primary: false,
        provider: "provider",
        type: "email",
        value: "new@lindorm.io",
        verified: true,
      }),
    );

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        verified: false,
      }),
    );
  });

  test("should throw on invalid options", async () => {
    options.type = IdentifierType.EXTERNAL;
    options.provider = undefined;

    await expect(addGenericIdentifier(ctx, identity, options)).rejects.toThrow(ClientError);
  });

  test("should throw on already verified identifier", async () => {
    options.verified = false;

    await expect(addGenericIdentifier(ctx, identity, options)).rejects.toThrow(ClientError);
  });
});
