import { createMockProteusSource } from "./create-mock-proteus-source";

describe("createMockProteusSource", () => {
  it("should create a mock source with all methods as jest.fn()", () => {
    const source = createMockProteusSource();

    expect(source).toMatchSnapshot();
  });

  it("should have correct default properties", () => {
    const source = createMockProteusSource();

    expect(source.namespace).toBeNull();
    expect(source.driverType).toBe("memory");
    expect(source.migrationsTable).toBeUndefined();
  });

  it("should return a mock repository from repository()", () => {
    const source = createMockProteusSource();
    const repo = source.repository();

    expect(repo).toBeDefined();
    expect(repo.find).toBeDefined();
    expect(jest.isMockFunction(repo.find)).toBe(true);
  });

  it("should return a new mock session from session()", () => {
    const source = createMockProteusSource();
    const session = source.session();

    expect(session).toBeDefined();
    expect(session).not.toBe(source);
    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
    expect(jest.isMockFunction(session.repository)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const source = createMockProteusSource();

    expect(await source.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const source = createMockProteusSource();
    const result = await source.transaction((ctx: unknown) => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", () => {
    const source = createMockProteusSource();
    const registry = source.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });
});
