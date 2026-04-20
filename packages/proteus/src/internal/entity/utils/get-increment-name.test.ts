import { getIncrementName } from "./get-increment-name";
import { Entity } from "../../../decorators/Entity";
import { Namespace } from "../../../decorators/Namespace";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { describe, expect, test } from "vitest";

@Entity({ name: "GetIncrementSimple" })
class GetIncrementSimple {
  @PrimaryKeyField()
  id!: string;
}

@Namespace("myApp")
@Entity({ name: "GetIncrementWithNs" })
class GetIncrementWithNs {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "GetIncrementNoNs" })
class GetIncrementNoNs {
  @PrimaryKeyField()
  id!: string;
}

describe("getIncrementName", () => {
  test("should return scoped name without namespace", () => {
    expect(getIncrementName(GetIncrementSimple, {})).toMatchSnapshot();
  });

  test("should return scoped name with namespace from decorator", () => {
    expect(getIncrementName(GetIncrementWithNs, {})).toMatchSnapshot();
  });

  test("should use namespace from options", () => {
    const result = getIncrementName(GetIncrementNoNs, { namespace: "opts" });
    expect(result.namespace).toBe("opts");
    expect(result.parts[0]).toBe("opts");
  });

  test("should prefer namespace from decorator over options", () => {
    const result = getIncrementName(GetIncrementWithNs, { namespace: "other" });
    expect(result.namespace).toBe("myApp");
  });

  test("should set type to increment", () => {
    const result = getIncrementName(GetIncrementSimple, {});
    expect(result.type).toBe("increment");
  });

  test("should build parts array with namespace", () => {
    const result = getIncrementName(GetIncrementWithNs, {});
    expect(result.parts).toEqual(["myApp", "increment", "GetIncrementWithNs"]);
  });

  test("should build parts array without namespace", () => {
    const result = getIncrementName(GetIncrementSimple, {});
    expect(result.parts).toEqual(["increment", "GetIncrementSimple"]);
  });

  test("should throw for 'system' namespace", () => {
    expect(() => getIncrementName(GetIncrementNoNs, { namespace: "system" })).toThrow(
      "The 'system' namespace is reserved for internal use",
    );
  });
});
