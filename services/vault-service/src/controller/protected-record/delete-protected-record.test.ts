import MockDate from "mockdate";
import { deleteProtectedRecordController } from "./delete-protected-record";
import { getTestProtectedRecord } from "../../test/entity";
import { ClientError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("deleteProtectedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        protectedRecord: getTestProtectedRecord(),
      },
      repository: {
        protectedRecordRepository: {
          destroy: jest.fn().mockResolvedValue(undefined),
        },
      },
      token: {
        bearerToken: {
          subject: "9168f571-2f25-4960-a585-330d1a07c094",
          subjectHint: "client",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteProtectedRecordController(ctx)).resolves.toStrictEqual({});

    expect(ctx.repository.protectedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on forbidden subject", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(deleteProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on forbidden subject hint", async () => {
    ctx.token.bearerToken.subjectHint = "wrong";

    await expect(deleteProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
