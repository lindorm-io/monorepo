import { Generated } from "./Generated.js";
import { IdentifierField } from "./IdentifierField.js";
import { Message } from "./Message.js";
import { getMessageMetadata } from "../internal/message/metadata/get-message-metadata.js";
import { MessageManager } from "../internal/message/classes/MessageManager.js";
import { clearRegistry } from "../internal/message/metadata/registry.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("IdentifierField", () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  it("should stage identifier field metadata as a pure marker", () => {
    class TestMsg {
      @IdentifierField()
      id!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);

    const field = metadata.fields[0];
    expect(field.key).toBe("id");
    expect(field.decorator).toBe("IdentifierField");
    expect(field.type).toBe("string");
    expect(field.nullable).toBe(false);
    expect(field.optional).toBe(false);
    expect(field.default).toBeNull();
  });

  it("should NOT stage a generated entry on its own", () => {
    class TestMsg {
      @IdentifierField()
      id!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated ?? []).toHaveLength(0);
  });

  it("should produce a base62 id when paired with @Generated()", () => {
    @Message({ name: "IdentifierGeneratedMsg" })
    class IdentifierGeneratedMsg {
      @IdentifierField()
      @Generated()
      id!: string;
    }

    const manager = new MessageManager({ target: IdentifierGeneratedMsg });
    const msg = manager.create();

    expect(msg.id).toMatch(/^[A-Za-z0-9]{24}$/);
  });

  it("should prefix the id with a lindorm_id namespace", () => {
    @Message({ name: "IdentifierNamespacedMsg" })
    class IdentifierNamespacedMsg {
      @IdentifierField()
      @Generated("lindorm_id", { namespace: "user" })
      id!: string;
    }

    const manager = new MessageManager({ target: IdentifierNamespacedMsg });
    const msg = manager.create();

    expect(msg.id).toMatch(/^user_[A-Za-z0-9]{24}$/);
  });

  it("should combine a namespace with a custom length", () => {
    @Message({ name: "IdentifierNamespacedLengthMsg" })
    class IdentifierNamespacedLengthMsg {
      @IdentifierField()
      @Generated("lindorm_id", { namespace: "u", length: 32 })
      id!: string;
    }

    const manager = new MessageManager({ target: IdentifierNamespacedLengthMsg });
    const msg = manager.create();

    expect(msg.id).toMatch(/^u_[A-Za-z0-9]{32}$/);
  });

  it("should propagate randomId's throw for an invalid namespace", () => {
    @Message({ name: "IdentifierBadNamespaceMsg" })
    class IdentifierBadNamespaceMsg {
      @IdentifierField()
      @Generated("lindorm_id", { namespace: "bad_ns" })
      id!: string;
    }

    const manager = new MessageManager({ target: IdentifierBadNamespaceMsg });

    expect(() => manager.create()).toThrow();
  });

  it("should NOT auto-fill the id without @Generated()", () => {
    @Message({ name: "IdentifierBareMsg" })
    class IdentifierBareMsg {
      @IdentifierField()
      id!: string;
    }

    const metadata = getMessageMetadata(IdentifierBareMsg);
    expect(metadata.generated).toHaveLength(0);

    const manager = new MessageManager({ target: IdentifierBareMsg });
    const msg = manager.create();

    expect(msg.id).toBeUndefined();
  });
});
