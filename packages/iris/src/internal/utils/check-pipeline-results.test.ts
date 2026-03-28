import { checkPipelineResults } from "./check-pipeline-results";

describe("checkPipelineResults", () => {
  it("should not throw when all results are successful", () => {
    const results: Array<[Error | null, unknown]> = [
      [null, "OK"],
      [null, 1],
    ];

    expect(() => checkPipelineResults(results)).not.toThrow();
  });

  it("should throw when results are null", () => {
    expect(() => checkPipelineResults(null)).toThrow(
      "Redis pipeline returned null results",
    );
  });

  it("should throw the first error encountered", () => {
    const error = new Error("WRONGTYPE Operation against a key");
    const results: Array<[Error | null, unknown]> = [
      [null, "OK"],
      [error, null],
    ];

    expect(() => checkPipelineResults(results)).toThrow(error);
  });

  it("should throw on the first error when multiple errors exist", () => {
    const error1 = new Error("first error");
    const error2 = new Error("second error");
    const results: Array<[Error | null, unknown]> = [
      [error1, null],
      [error2, null],
    ];

    expect(() => checkPipelineResults(results)).toThrow(error1);
  });
});
