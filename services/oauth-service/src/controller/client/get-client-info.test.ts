import MockDate from "mockdate";
import { getClientInfoController } from "./get-client-info";
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
    await expect(getClientInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
