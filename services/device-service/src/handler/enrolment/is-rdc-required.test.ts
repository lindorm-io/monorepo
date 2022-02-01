import { isRdcRequired } from "./is-rdc-required";

describe("initialiseEnrolmentController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      metadata: {
        agent: {
          os: "os",
          platform: "platform",
        },
        device: {
          installationId: "installationId",
          uniqueId: "uniqueId",
        },
        identifiers: {
          fingerprint: "fingerprint",
        },
      },
      repository: {
        deviceLinkRepository: {
          findMany: jest.fn().mockResolvedValue([
            {
              fingerprint: "fingerprint",
              installationId: "installationId",
              uniqueId: "uniqueId",
            },
          ]),
        },
      },
    };
  });

  test("should resolve false", async () => {
    await expect(isRdcRequired(ctx, "identityId")).resolves.toBe(false);

    expect(ctx.repository.deviceLinkRepository.findMany).toHaveBeenCalled();
  });

  test("should resolve true", async () => {
    ctx.repository.deviceLinkRepository.findMany.mockResolvedValue([
      {
        fingerprint: "fingerprint",
        installationId: "installationId",
        uniqueId: "uniqueId",
      },
      {
        fingerprint: "fingerprint-2",
        installationId: "installationId-2",
        uniqueId: "uniqueId-2",
      },
    ]);

    await expect(isRdcRequired(ctx, "identityId")).resolves.toBe(true);
  });
});
