import { createMockLogger } from "@lindorm/logger";
import { IKafkaSource } from "../interfaces";
import { createHttpKafkaSourceMiddleware } from "./http-kafka-source-middleware";

describe("createHttpKafkaSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IKafkaSource;

  beforeEach(() => {
    ctx = { logger: createMockLogger() };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpKafkaSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.kafka).toEqual({ clonedSource: true });
  });
});
