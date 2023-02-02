import { assertAcrValues } from "./assert-acr-values";
import { ClientError } from "@lindorm-io/errors";

describe("assertAcrValues", () => {
  test("should resolve", () => {
    expect(() => assertAcrValues(["loa_1"])).not.toThrow();
  });

  test("should throw on missing acr values", () => {
    expect(() => assertAcrValues([])).toThrow(ClientError);
  });

  test("should throw on invalid acr values", () => {
    expect(() => assertAcrValues(["wrong"])).toThrow(ClientError);
  });
});
