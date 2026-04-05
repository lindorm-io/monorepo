import { createMockProteusClone } from "./create-mock-proteus-clone";
import { NotSupportedError } from "../errors";

describe("createMockProteusClone", () => {
  it("should create a mock clone with all methods as jest.fn()", () => {
    const clone = createMockProteusClone();

    expect(clone).toMatchSnapshot();
  });

  it("should have correct default properties", () => {
    const clone = createMockProteusClone();

    expect(clone.namespace).toBeNull();
    expect(clone.driverType).toBe("memory");
    expect(clone.migrationsTable).toBeUndefined();
    expect(clone.breaker).toBeNull();
  });

  it("should return a mock repository from repository()", () => {
    const clone = createMockProteusClone();
    const repo = clone.repository();

    expect(repo).toBeDefined();
    expect(jest.isMockFunction(repo.find)).toBe(true);
  });

  it("should throw NotSupportedError on on()", () => {
    const clone = createMockProteusClone();

    expect(() => clone.on()).toThrow(NotSupportedError);
  });

  it("should throw NotSupportedError on clone()", () => {
    const clone = createMockProteusClone();

    expect(() => clone.clone()).toThrow(NotSupportedError);
  });

  it("should reject with NotSupportedError on setup()", async () => {
    const clone = createMockProteusClone();

    await expect(clone.setup()).rejects.toThrow(NotSupportedError);
  });

  it("should resolve true for ping()", async () => {
    const clone = createMockProteusClone();

    expect(await clone.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const clone = createMockProteusClone();
    const result = await clone.transaction((ctx: unknown) => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", () => {
    const clone = createMockProteusClone();
    const registry = clone.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });
});
