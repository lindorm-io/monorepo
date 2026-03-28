import { findMessageByName } from "#internal/message/metadata/registry";
import { Message } from "./Message";

describe("Message", () => {
  it("should stage message metadata with class name", () => {
    @Message()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.message).toMatchSnapshot();
  });

  it("should stage message metadata with custom name", () => {
    @Message({ name: "CustomName" })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.message).toMatchSnapshot();
  });

  it("should register in the message registry", () => {
    @Message({ name: "RegisteredMsg" })
    class RegisteredMsg {}

    expect(findMessageByName("RegisteredMsg")).toBe(RegisteredMsg);
  });

  it("should strip _vN suffix from class name", () => {
    @Message()
    class OrderCreated_v2 {}

    const meta = (OrderCreated_v2 as any)[Symbol.metadata];
    expect(meta.message.name).toBe("OrderCreated");
  });

  it("should strip _VN suffix from class name", () => {
    @Message()
    class OrderCreated_V3 {}

    const meta = (OrderCreated_V3 as any)[Symbol.metadata];
    expect(meta.message.name).toBe("OrderCreated");
  });

  it("should strip _vN suffix from custom name", () => {
    @Message({ name: "MyEvent_v5" })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.message.name).toBe("MyEvent");
  });

  it("should register with stripped name", () => {
    @Message()
    class RegisteredVersioned_v2 {}

    expect(findMessageByName("RegisteredVersioned")).toBe(RegisteredVersioned_v2);
  });

  it("should not strip when no version suffix present", () => {
    @Message()
    class PlainMessage {}

    const meta = (PlainMessage as any)[Symbol.metadata];
    expect(meta.message.name).toBe("PlainMessage");
  });
});
