import { resolveSubject } from "./resolve-subject";

describe("resolveSubject", () => {
  it("should build subject from prefix and topic", () => {
    expect(resolveSubject("iris", "orders.created")).toMatchSnapshot();
  });

  it("should handle custom prefix", () => {
    expect(resolveSubject("myapp", "users.updated")).toMatchSnapshot();
  });

  it("should handle empty prefix", () => {
    expect(resolveSubject("", "test-topic")).toMatchSnapshot();
  });
});
