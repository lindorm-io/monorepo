import MockDate from "mockdate";
import { getClientController } from "./get-client";
import { createTestClient } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClientInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
      },
    };
  });

  test("should resolve client", async () => {
    await expect(getClientController(ctx)).resolves.toMatchSnapshot();
  });
});
