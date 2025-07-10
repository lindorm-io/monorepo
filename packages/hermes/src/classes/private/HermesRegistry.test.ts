import { join } from "path";
import { HermesRegistry } from "./HermesRegistry";

describe("HermesRegistry", () => {
  let registry: HermesRegistry;

  beforeEach(() => {
    registry = new HermesRegistry();
  });

  test("should add", () => {
    expect(() =>
      registry.add([join(__dirname, "..", "..", "__fixtures__", "modules")]),
    ).not.toThrow();

    expect(registry).toMatchSnapshot();
  });
});
