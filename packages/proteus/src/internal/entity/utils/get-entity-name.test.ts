import { getEntityName } from "./get-entity-name.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";
import { Entity } from "../../../decorators/Entity.js";
import { Namespace } from "../../../decorators/Namespace.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "GetEntityNameSimple" })
class GetEntityNameSimple {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Namespace("myApp")
@Entity({ name: "GetEntityNameWithNs" })
class GetEntityNameWithNs {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "GetEntityNameNoNs" })
class GetEntityNameNoNs {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

describe("getEntityName", () => {
  test("should return scoped name without namespace", () => {
    expect(getEntityName(getEntityMetadata(GetEntityNameSimple), {})).toMatchSnapshot();
  });

  test("should return scoped name with namespace from decorator", () => {
    expect(getEntityName(getEntityMetadata(GetEntityNameWithNs), {})).toMatchSnapshot();
  });

  test("should prefer namespace from decorator over options", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameWithNs), {
      namespace: "other",
    });
    expect(result.namespace).toBe("myApp");
  });

  test("should use namespace from options when not in decorator", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameNoNs), {
      namespace: "opts",
    });
    expect(result.namespace).toBe("opts");
    expect(result.parts[0]).toBe("opts");
  });

  test("should preserve user-provided namespace without transformation", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameNoNs), {
      namespace: "MyApp",
    });
    expect(result.namespace).toBe("MyApp");
  });

  test("should set namespace to null when not provided", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameSimple), {});
    expect(result.namespace).toBeNull();
  });

  test("should set type to snake_cased decorator", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameSimple), {});
    expect(result.type).toBe("entity");
  });

  test("should build parts array with namespace", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameWithNs), {});
    expect(result.parts).toEqual(["myApp", "entity", "GetEntityNameWithNs"]);
  });

  test("should build parts array without namespace", () => {
    const result = getEntityName(getEntityMetadata(GetEntityNameSimple), {});
    expect(result.parts).toEqual(["entity", "GetEntityNameSimple"]);
  });

  test("should throw for 'system' namespace", () => {
    expect(() =>
      getEntityName(getEntityMetadata(GetEntityNameNoNs), { namespace: "system" }),
    ).toThrow("The 'system' namespace is reserved for internal use");
  });
});
