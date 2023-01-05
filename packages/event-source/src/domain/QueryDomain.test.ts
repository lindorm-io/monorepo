import { IN_MEMORY_VIEW_STORE } from "../infrastructure/memory/in-memory";
import { QueryDomain } from "./QueryDomain";
import { QueryHandlerImplementation } from "../handler";
import { TEST_AGGREGATE_COMMAND_HANDLER } from "../fixtures/aggregate-command-handler.fixture";
import { ViewStoreAttributes } from "../types";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

describe("QueryDomain", () => {
  const logger = createMockLogger();

  let domain: QueryDomain;

  beforeEach(() => {
    domain = new QueryDomain({}, logger);
  });

  test("should register query handler", () => {
    const handler = new QueryHandlerImplementation({
      queryName: "test_query",
      view: { name: "test_view", context: "defaults" },
      handler: async () => {},
    });

    expect(() => domain.registerQueryHandler(handler)).not.toThrow();
  });

  test("should handle query", async () => {
    const attributes: ViewStoreAttributes = {
      id: randomUUID(),
      name: "test_view",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: ["processed"],
      revision: 1,
      state: { data: "data" },
      created_at: new Date(),
      updated_at: new Date(),
    };

    IN_MEMORY_VIEW_STORE.push(attributes);

    class TestQuery {
      public constructor(public readonly id: string) {}
    }

    const handler = new QueryHandlerImplementation<TestQuery>({
      queryName: "test_query",
      view: { name: "test_view", context: "default" },
      handler: async (ctx) => await ctx.repositories.memory.findById(ctx.query.id),
    });

    domain.registerQueryHandler(handler);

    await expect(domain.query(new TestQuery(attributes.id))).resolves.toStrictEqual({
      id: attributes.id,
      state: { data: "data" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should throw on invalid handler type", () => {
    // @ts-ignore
    expect(() => domain.registerQueryHandler(TEST_AGGREGATE_COMMAND_HANDLER)).toThrow();
  });

  test("should throw on existing query handler", () => {
    const handler = new QueryHandlerImplementation({
      queryName: "test_query",
      view: { name: "test_view", context: "defaults" },
      handler: async () => {},
    });

    expect(() => domain.registerQueryHandler(handler)).not.toThrow();
    expect(() => domain.registerQueryHandler(handler)).toThrow();
  });
});
