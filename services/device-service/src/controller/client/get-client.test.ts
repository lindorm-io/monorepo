import { createTestClient } from "../../fixtures/entity";
import { getClientController } from "./get-client";

describe("getClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
      },
    };
  });

  test("should get a client", async () => {
    await expect(getClientController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        name: "Test Client Name",
        publicKeyId: expect.any(String),
      },
    });
  });
});
