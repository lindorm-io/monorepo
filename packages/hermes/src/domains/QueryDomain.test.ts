import { createMockLogger } from "@lindorm/logger";
import { createMockMongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { HermesQueryHandler } from "../handlers";
import { ViewStoreAttributes } from "../types";
import { QueryDomain } from "./QueryDomain";

describe("QueryDomain", () => {
  const logger = createMockLogger();

  let domain: QueryDomain;
  let mongo: any;

  beforeEach(() => {
    mongo = createMockMongoSource();

    mongo.collection.mockImplementation(() => ({
      findOne: jest.fn().mockImplementation((args: any) => ({
        id: randomUUID(),
        state: { data: "data" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        ...args,
      })),
    }));

    domain = new QueryDomain({ mongo, logger });
  });

  test("should register query handler", () => {
    const handler = new HermesQueryHandler({
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
      meta: {},
      processed_causation_ids: ["processed"],
      revision: 1,
      state: { data: "data" },
      created_at: new Date(),
      updated_at: new Date(),
    };

    class TestQuery {
      public constructor(public readonly id: string) {}
    }

    const handler = new HermesQueryHandler<TestQuery>({
      queryName: "test_query",
      view: { name: "test_view", context: "default" },
      handler: async (ctx) => await ctx.repositories.mongo.findById(ctx.query.id),
    });

    domain.registerQueryHandler(handler);

    await expect(domain.query(new TestQuery(attributes.id))).resolves.toEqual({
      id: attributes.id,
      state: { data: "data" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should throw on invalid handler type", () => {
    expect(() =>
      // @ts-expect-error
      domain.registerQueryHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).toThrow();
  });

  test("should throw on existing query handler", () => {
    const handler = new HermesQueryHandler({
      queryName: "test_query",
      view: { name: "test_view", context: "defaults" },
      handler: async () => {},
    });

    expect(() => domain.registerQueryHandler(handler)).not.toThrow();
    expect(() => domain.registerQueryHandler(handler)).toThrow();
  });
});
