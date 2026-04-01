import { createMockHermes } from "./create-mock-hermes";

describe("createMockHermes", () => {
  it("should create a mock hermes with all methods as jest.fn()", () => {
    const mock = createMockHermes();

    expect(mock).toMatchSnapshot();
  });

  it("should have correct default status", () => {
    const mock = createMockHermes();

    expect(mock.status).toBe("ready");
  });

  it("should return a new mock from clone()", () => {
    const mock = createMockHermes();
    const cloned = mock.clone();

    expect(cloned).toBeDefined();
    expect(cloned).not.toBe(mock);
    expect(cloned.status).toBe("ready");
    expect(jest.isMockFunction(cloned.setup)).toBe(true);
  });

  it("should resolve an aggregate identifier from command()", async () => {
    const mock = createMockHermes();
    const result = await mock.command({});

    expect(result).toEqual({ id: "mock-id", name: "mock", namespace: "mock" });
  });

  it("should resolve undefined from query()", async () => {
    const mock = createMockHermes();
    const result = await mock.query({});

    expect(result).toBeUndefined();
  });

  it("should resolve 0 from admin.purgeCausations()", async () => {
    const mock = createMockHermes();
    const result = await mock.admin.purgeCausations();

    expect(result).toBe(0);
  });

  it("should return a replay handle from admin.replay.view()", () => {
    const mock = createMockHermes();
    const handle = mock.admin.replay.view(class {});

    expect(handle).toBeDefined();
    expect(handle.on).toBeDefined();
    expect(handle.cancel).toBeDefined();
    expect(handle.promise).toBeInstanceOf(Promise);
  });

  it("should return a replay handle from admin.replay.aggregate()", () => {
    const mock = createMockHermes();
    const handle = mock.admin.replay.aggregate(class {});

    expect(handle).toBeDefined();
    expect(handle.on).toBeDefined();
    expect(handle.cancel).toBeDefined();
    expect(handle.promise).toBeInstanceOf(Promise);
  });
});
