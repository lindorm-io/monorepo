import { createMockProteusSession } from "./create-mock-proteus-session";

describe("createMockProteusSession", () => {
  it("should create a mock session with all methods as jest.fn()", () => {
    const session = createMockProteusSession();

    expect(session).toMatchSnapshot();
  });

  it("should have correct default properties", () => {
    const session = createMockProteusSession();

    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
  });

  it("should return a mock repository from repository()", () => {
    const session = createMockProteusSession();
    const repo = session.repository();

    expect(repo).toBeDefined();
    expect(jest.isMockFunction(repo.find)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const session = createMockProteusSession();

    expect(await session.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const session = createMockProteusSession();
    const result = await session.transaction((ctx: unknown) => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", () => {
    const session = createMockProteusSession();
    const registry = session.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });
});
