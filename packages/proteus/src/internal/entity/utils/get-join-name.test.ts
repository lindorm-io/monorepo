import { getJoinName } from "./get-join-name";
import { describe, expect, test } from "vitest";

describe("getJoinName", () => {
  test("should return scoped name without namespace", () => {
    expect(getJoinName("user_post", {})).toMatchSnapshot();
  });

  test("should return scoped name with namespace", () => {
    expect(getJoinName("user_post", { namespace: "myApp" })).toMatchSnapshot();
  });

  test("should preserve user-provided namespace without transformation", () => {
    const result = getJoinName("user_post", { namespace: "MyApp" });
    expect(result.namespace).toBe("MyApp");
  });

  test("should set namespace to null when not provided", () => {
    const result = getJoinName("user_post", {});
    expect(result.namespace).toBeNull();
  });

  test("should set type to join", () => {
    const result = getJoinName("user_post", {});
    expect(result.type).toBe("join");
  });

  test("should use join table as name", () => {
    const result = getJoinName("post_tag", {});
    expect(result.name).toBe("post_tag");
  });

  test("should build parts array with namespace", () => {
    const result = getJoinName("user_post", { namespace: "myApp" });
    expect(result.parts).toEqual(["myApp", "join", "user_post"]);
  });

  test("should build parts array without namespace", () => {
    const result = getJoinName("user_post", {});
    expect(result.parts).toEqual(["join", "user_post"]);
  });

  test("should throw for 'system' namespace", () => {
    expect(() => getJoinName("user_post", { namespace: "system" })).toThrow(
      "The 'system' namespace is reserved for internal use",
    );
  });

  test("should throw when join name exceeds 63 characters", () => {
    const longJoinTable = "a".repeat(64);
    expect(() => getJoinName(longJoinTable, {})).toThrow(
      "Join name exceeds 63 characters",
    );
  });
});
