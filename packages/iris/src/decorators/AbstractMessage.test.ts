import { AbstractMessage } from "./AbstractMessage";

describe("AbstractMessage", () => {
  it("should set __abstract flag on metadata", () => {
    @AbstractMessage()
    class BaseMsg {}

    const meta = (BaseMsg as any)[Symbol.metadata];
    expect(meta.__abstract).toBe(true);
  });

  it("should stage a MetaMessage with decorator AbstractMessage", () => {
    @AbstractMessage()
    class BaseMsg {}

    const meta = (BaseMsg as any)[Symbol.metadata];
    expect(meta.message).toMatchSnapshot();
  });

  it("should derive name from the class", () => {
    @AbstractMessage()
    class MyAbstractEvent {}

    const meta = (MyAbstractEvent as any)[Symbol.metadata];
    expect(meta.message.name).toBe("MyAbstractEvent");
  });
});
