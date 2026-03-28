import { Field } from "../../../decorators/Field";
import { IdentifierField } from "../../../decorators/IdentifierField";
import { Message } from "../../../decorators/Message";
import { clearMetadataCache } from "./registry";
import { getMessageMetadata } from "./get-message-metadata";

describe("getMessageMetadata", () => {
  beforeEach(() => {
    clearMetadataCache();
  });

  @Message({ name: "CachedMsg" })
  class CachedMsg {
    @IdentifierField()
    id!: string;

    @Field("string")
    name!: string;
  }

  it("should return correct metadata", () => {
    const metadata = getMessageMetadata(CachedMsg);

    const stable = {
      ...metadata,
      target: metadata.target?.name,
      fields: metadata.fields.map((f) => ({
        ...f,
        default: typeof f.default === "function" ? "[function]" : f.default,
      })),
    };

    expect(stable).toMatchSnapshot();
  });

  it("should return cached metadata on second call (same reference)", () => {
    const first = getMessageMetadata(CachedMsg);
    const second = getMessageMetadata(CachedMsg);
    expect(first).toBe(second);
  });

  it("should rebuild after clearMetadataCache", () => {
    const first = getMessageMetadata(CachedMsg);
    clearMetadataCache();
    const second = getMessageMetadata(CachedMsg);

    // Different reference but equivalent content
    expect(first).not.toBe(second);
    expect(first.message.name).toBe(second.message.name);
  });

  it("should throw when no message metadata exists", () => {
    class NoMsg {
      name!: string;
    }

    expect(() => getMessageMetadata(NoMsg)).toThrow("Message metadata not found");
  });
});
