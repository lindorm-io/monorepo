import {
  clearMetadataCache,
  clearRegistry,
  findMessageByName,
  findMessageByTarget,
  getCachedMetadata,
  registerMessage,
  setCachedMetadata,
} from "./registry";
import { afterEach, describe, expect, it } from "vitest";

describe("registry", () => {
  afterEach(() => {
    clearMetadataCache();
  });

  describe("registerMessage + findMessageByName", () => {
    it("should round-trip name to target", () => {
      class UserCreated {}
      registerMessage("UserCreated", UserCreated);

      expect(findMessageByName("UserCreated")).toBe(UserCreated);
    });
  });

  describe("registerMessage + findMessageByTarget", () => {
    it("should round-trip target to name", () => {
      class OrderPlaced {}
      registerMessage("OrderPlaced", OrderPlaced);

      expect(findMessageByTarget(OrderPlaced)).toBe("OrderPlaced");
    });
  });

  describe("re-registration", () => {
    it("should overwrite previous entry for HMR", () => {
      class OriginalClass {}
      class ReplacementClass {}

      registerMessage("MyMessage", OriginalClass);
      registerMessage("MyMessage", ReplacementClass);

      expect(findMessageByName("MyMessage")).toBe(ReplacementClass);
      expect(findMessageByTarget(ReplacementClass)).toBe("MyMessage");
      expect(findMessageByTarget(OriginalClass)).toBeUndefined();
    });
  });

  describe("findMessageByName with unknown name", () => {
    it("should return undefined", () => {
      expect(findMessageByName("NonExistent")).toBeUndefined();
    });
  });

  describe("getCachedMetadata / setCachedMetadata", () => {
    it("should round-trip cached metadata", () => {
      class MyMessage {}
      const metadata = {
        target: MyMessage,
        broadcast: false,
        compressed: null,
        deadLetter: false,
        encrypted: null,
        fields: [],
        generated: [],
        headers: [],
        hooks: [],
        message: { decorator: "Message" as const, name: "MyMessage" },
        namespace: null,
        version: 1,
        persistent: false,
        priority: null,
        retry: null,
        topic: null,
        expiry: null,
      } as any;

      setCachedMetadata(MyMessage, metadata);

      expect(getCachedMetadata(MyMessage)).toBe(metadata);
    });
  });

  describe("clearMetadataCache", () => {
    it("should clear all cached entries", () => {
      class A {}
      class B {}
      const metaA = { message: { name: "A" } } as any;
      const metaB = { message: { name: "B" } } as any;

      setCachedMetadata(A, metaA);
      setCachedMetadata(B, metaB);

      clearMetadataCache();

      expect(getCachedMetadata(A)).toBeUndefined();
      expect(getCachedMetadata(B)).toBeUndefined();
    });
  });

  describe("clearRegistry", () => {
    it("should clear all three maps", () => {
      class X {}
      registerMessage("X", X);
      setCachedMetadata(X, { message: { name: "X" } } as any);

      clearRegistry();

      expect(findMessageByName("X")).toBeUndefined();
      expect(findMessageByTarget(X)).toBeUndefined();
      expect(getCachedMetadata(X)).toBeUndefined();
    });
  });
});
