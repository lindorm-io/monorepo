import { createMockLogger } from "@lindorm/logger";
import { IKafkaSource } from "../interfaces";
import { createSocketKafkaSourceMiddleware } from "./socket-kafka-source-middleware";

describe("createSocketKafkaSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IKafkaSource;

  beforeEach(() => {
    ctx = { logger: createMockLogger() };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketKafkaSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.kafka).toEqual({ clonedSource: true });
  });
});
