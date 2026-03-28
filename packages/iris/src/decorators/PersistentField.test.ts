import { PersistentField } from "./PersistentField";

describe("PersistentField", () => {
  it("should stage persistent field metadata", () => {
    class TestMsg {
      @PersistentField()
      persistent!: boolean;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });
});
