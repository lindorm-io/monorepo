import { resolveStreamName } from "./resolve-stream-name";

describe("resolveStreamName", () => {
  it("should return uppercase stream name with IRIS prefix", () => {
    expect(resolveStreamName("iris")).toMatchSnapshot();
  });

  it("should sanitize special characters", () => {
    expect(resolveStreamName("my-app.v2")).toMatchSnapshot();
  });

  it("should handle empty prefix", () => {
    expect(resolveStreamName("")).toMatchSnapshot();
  });
});
