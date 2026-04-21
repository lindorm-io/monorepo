import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import { publishToExchange } from "./publish-to-exchange.js";
import { describe, expect, it, vi } from "vitest";

type PublishCallback = (err: Error | null, ok?: any) => void;

const createMockChannel = (overrides?: {
  publishReturn?: boolean;
  confirmError?: Error | null;
}) => {
  const confirmError = overrides?.confirmError ?? null;
  const publishReturn = overrides?.publishReturn ?? true;

  return {
    publish: vi.fn(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: any,
        callback: PublishCallback,
      ) => {
        if (publishReturn) {
          process.nextTick(() => callback(confirmError as any));
        }
        return publishReturn;
      },
    ),
  };
};

describe("publishToExchange", () => {
  it("should resolve on successful publish with confirm", async () => {
    const channel = createMockChannel();
    const content = Buffer.from("test");

    await expect(
      publishToExchange(channel as any, "iris", "orders.created", content, {
        persistent: true,
      }),
    ).resolves.toBeUndefined();

    expect(channel.publish).toHaveBeenCalledWith(
      "iris",
      "orders.created",
      content,
      { persistent: true },
      expect.any(Function),
    );
  });

  it("should reject with IrisPublishError on confirm failure", async () => {
    const channel = createMockChannel({
      confirmError: new Error("nacked"),
    });

    await expect(
      publishToExchange(
        channel as any,
        "iris",
        "orders.created",
        Buffer.from("test"),
        {},
      ),
    ).rejects.toThrow(IrisPublishError);
  });

  it("should include exchange and routing key in error debug", async () => {
    const channel = createMockChannel({
      confirmError: new Error("nacked"),
    });

    try {
      await publishToExchange(
        channel as any,
        "my-exchange",
        "my-key",
        Buffer.from("test"),
        {},
      );
      fail("should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(IrisPublishError);
      expect(err.debug).toMatchSnapshot();
    }
  });

  it("should reject when channel write buffer is full", async () => {
    const channel = createMockChannel({ publishReturn: false });

    await expect(
      publishToExchange(
        channel as any,
        "iris",
        "orders.created",
        Buffer.from("test"),
        {},
      ),
    ).rejects.toThrow(IrisPublishError);
  });

  it("should reject with buffer full message when publish returns false", async () => {
    const channel = createMockChannel({ publishReturn: false });

    try {
      await publishToExchange(
        channel as any,
        "iris",
        "orders.created",
        Buffer.from("test"),
        {},
      );
      fail("should have thrown");
    } catch (err: any) {
      expect(err.message).toMatchSnapshot();
    }
  });
});
