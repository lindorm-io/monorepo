import { getProvidersListController } from "./get-providers-list";

describe("getProvidersListController", () => {
  let ctx: any;

  test("should resolve", async () => {
    await expect(getProvidersListController(ctx)).resolves.toStrictEqual({
      body: {
        providers: ["apple", "google", "microsoft"],
      },
    });
  });
});
