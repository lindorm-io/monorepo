import { getTestDeviceLink } from "../../test/entity";
import { getIdentityDeviceLinksController } from "./get-identity-device-links";

describe("getIdentityDeviceLinksController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "adc4242d-c836-4d0f-a87a-5c98859d8c0e",
      },
      repository: {
        deviceLinkRepository: {
          findMany: jest.fn().mockResolvedValue([
            getTestDeviceLink({
              id: "3d9da7e5-ab8b-485d-8081-acc9249ac5fd",
            }),
            getTestDeviceLink({
              id: "dfe43191-cfc7-4420-b281-a839a3ba2ea9",
            }),
            getTestDeviceLink({
              id: "b91606fa-b522-4dcb-93bd-e436b2cf301d",
              active: false,
            }),
            getTestDeviceLink({
              id: "24017a7c-d0f5-44da-94a3-5afbcb5f6e1b",
              trusted: false,
            }),
          ]),
        },
      },
    };
  });

  test("should resolve active and trusted deviceLink identifiers", async () => {
    await expect(getIdentityDeviceLinksController(ctx)).resolves.toStrictEqual({
      body: {
        deviceLinks: [
          "3d9da7e5-ab8b-485d-8081-acc9249ac5fd",
          "dfe43191-cfc7-4420-b281-a839a3ba2ea9",
        ],
      },
    });
  });
});
