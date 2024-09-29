import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
import { IPostgresViewRepository } from "../../interfaces";
import { ViewIdentifier, ViewStoreAttributes } from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresViewRepository } from "./PostgresViewRepository";
import { PostgresViewStore } from "./PostgresViewStore";

const insertView = async (
  source: IPostgresSource,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  const text = `
    INSERT INTO ${getViewStoreName(attributes)} (
      id,
      name,
      context,
      destroyed,
      hash,
      meta,
      processed_causation_ids,
      revision,
      state,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `;
  const values = [
    attributes.id,
    attributes.name,
    attributes.context,
    attributes.destroyed,
    attributes.hash,
    JsonKit.stringify(attributes.meta),
    JSON.stringify(attributes.processed_causation_ids),
    attributes.revision,
    JsonKit.stringify(attributes.state),
    attributes.created_at,
  ];
  await source.query(text, values);
};

describe("PostgresViewRepository", () => {
  const logger = createMockLogger();

  let source: IPostgresSource;
  let identifier: ViewIdentifier;
  let repository: IPostgresViewRepository;

  let view1: string;
  let view2: string;
  let view3: string;
  let view4: string;

  beforeAll(async () => {
    source = new PostgresSource({
      logger: createMockLogger(),
      url: "postgres://root:example@localhost:5432/default",
    });

    const store = new PostgresViewStore(source, logger);

    // @ts-ignore
    await store.initialise();

    // @ts-ignore
    await store.initialiseView(TEST_VIEW_IDENTIFIER, {});

    identifier = { ...TEST_VIEW_IDENTIFIER, id: randomUUID() };
    repository = new PostgresViewRepository(source, identifier, logger);

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();
    view4 = randomUUID();

    await insertView(source, {
      id: view1,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { one: 1, common: "common" },
      created_at: new Date("2022-01-01T01:00:00.000Z"),
      updated_at: new Date(),
    });

    await insertView(source, {
      id: view2,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 2,
      state: { two: 2, common: "common" },
      created_at: new Date("2022-01-01T02:00:00.000Z"),
      updated_at: new Date(),
    });

    await insertView(source, {
      id: view3,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 3,
      state: { three: 3, common: "uncommon" },
      created_at: new Date("2022-01-01T03:00:00.000Z"),
      updated_at: new Date(),
    });

    await insertView(source, {
      id: view4,
      name: identifier.name,
      context: identifier.context,
      destroyed: true,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 4,
      state: { four: 4, common: "common" },
      created_at: new Date("2022-01-01T04:00:00.000Z"),
      updated_at: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find", async () => {
    await expect(
      repository.find({
        where: {
          text: "state ->> 'common' = $1",
          values: ["common"],
        },
        orderBy: {
          created_at: "ASC",
        },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        {
          id: view1,
          state: {
            common: "common",
            one: 1,
          },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: view2,
          state: {
            common: "common",
            two: 2,
          },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]),
    );
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toEqual({
      id: view3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(
      repository.findOne({
        where: {
          text: `id = $1`,
          values: [view1],
        },
      }),
    ).resolves.toEqual({
      id: view1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
