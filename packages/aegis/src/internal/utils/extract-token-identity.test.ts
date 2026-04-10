import { extractTokenIdentity } from "./extract-token-identity";

describe("extractTokenIdentity", () => {
  test("should return undelegated identity when no act claim is present", () => {
    expect(extractTokenIdentity({ sub: "user-1" })).toMatchSnapshot();
  });

  test("should return single-level actor chain", () => {
    expect(
      extractTokenIdentity({
        sub: "user-1",
        act: { sub: "service-1", iss: "https://issuer.example/" },
      }),
    ).toMatchSnapshot();
  });

  test("should walk three-level nested act chain outermost to deepest", () => {
    expect(
      extractTokenIdentity({
        sub: "user-1",
        act: {
          sub: "service-1",
          act: {
            sub: "service-2",
            act: {
              sub: "service-3",
            },
          },
        },
      }),
    ).toMatchSnapshot();
  });

  test("should handle undefined subject", () => {
    expect(extractTokenIdentity({})).toMatchSnapshot();
  });
});
