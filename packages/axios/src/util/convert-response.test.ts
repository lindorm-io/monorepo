import { convertResponse } from "./convert-response";

describe("convertResponse", () => {
  test("should resolve a limited response object", () => {
    expect(
      convertResponse({
        data: { data: true },
        extraIgnored1: 1,
        extraIgnored2: 2,
        headers: { headers: true },
        ignored: { object: "withData" },
        status: 200,
        statusText: "OK",
      } as any),
    ).toMatchSnapshot();
  });
});
