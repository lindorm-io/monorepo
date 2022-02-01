import { Identity } from "../entity";
import { getDisplayName } from "./get-display-name";

describe("getDisplayName", () => {
  test("should resolve display name as string", () => {
    expect(
      getDisplayName(
        new Identity({
          displayName: {
            name: "displayName",
            number: 124,
          },
        }),
      ),
    ).toBe("displayName#0124");
  });

  test("should resolve null", () => {
    expect(getDisplayName(new Identity({}))).toBe(null);
  });
});
