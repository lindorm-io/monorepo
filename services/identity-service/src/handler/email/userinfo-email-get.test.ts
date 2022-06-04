import { Email } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { userinfoEmailGet } from "./userinfo-email-get";

describe("userinfoEmailGet", () => {
  const email1 = new Email({
    identityId: "identityId",
    email: "email1",
    primary: true,
    verified: true,
    updated: new Date("2021-01-01T08:00:00.000Z"),
  });
  const email2 = new Email({
    identityId: "identityId",
    email: "email2",
    primary: false,
    verified: true,
    updated: new Date("2021-01-02T08:00:00.000Z"),
  });
  const email3 = new Email({
    identityId: "identityId",
    email: "email3",
    primary: false,
    verified: false,
    updated: new Date("2021-01-03T08:00:00.000Z"),
  });
  const email4 = new Email({
    identityId: "identityId",
    email: "email4",
    primary: false,
    verified: false,
    updated: new Date("2021-01-04T08:00:00.000Z"),
  });
  const email5 = new Email({
    identityId: "identityId",
    email: "email5",
    primary: false,
    verified: false,
    updated: new Date("2021-01-05T08:00:00.000Z"),
  });

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        emailRepository: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };
  });

  test("should base result on primary", async () => {
    ctx.repository.emailRepository.findMany.mockResolvedValue([email1, email2, email3]);

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: "email1",
      emailVerified: true,
    });
  });

  test("should base result on verified", async () => {
    ctx.repository.emailRepository.findMany.mockResolvedValue([email2, email3]);

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: "email2",
      emailVerified: true,
    });
  });

  test("should base result on updated", async () => {
    ctx.repository.emailRepository.findMany.mockResolvedValue([email3, email4, email5]);

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: "email5",
      emailVerified: false,
    });
  });

  test("should resolve the only available email", async () => {
    ctx.repository.emailRepository.findMany.mockResolvedValue([email3]);

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: "email3",
      emailVerified: false,
    });
  });

  test("should resolve an empty result when no emails can be found", async () => {
    ctx.repository.emailRepository.findMany.mockResolvedValue([]);

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: null,
      emailVerified: false,
    });
  });

  test("should resolve an empty result when an error is thrown", async () => {
    ctx.repository.emailRepository.findMany.mockRejectedValue(new Error("message"));

    await expect(userinfoEmailGet(ctx, "identityId")).resolves.toStrictEqual({
      email: null,
      emailVerified: false,
    });
  });
});
