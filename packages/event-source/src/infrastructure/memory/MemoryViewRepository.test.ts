import { MemoryViewRepository } from "./MemoryViewRepository";
import { ViewIdentifier } from "../../types";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { IN_MEMORY_VIEW_STORE } from "./in-memory";

describe("MemoryViewRepository", () => {
  let identifier: ViewIdentifier;
  let repository: MemoryViewRepository;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    identifier = { context: "view_repository", name: "name", id: randomUUID() };

    repository = new MemoryViewRepository({ name: identifier.name, context: identifier.context });

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    IN_MEMORY_VIEW_STORE.push({
      ...identifier,
      id: view1,
      destroyed: false,
      processed_causation_ids: [],
      hash: randomString(16),
      meta: {},
      revision: 1,
      state: { one: 1, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    IN_MEMORY_VIEW_STORE.push({
      ...identifier,
      id: view2,
      destroyed: false,
      processed_causation_ids: [],
      hash: randomString(16),
      meta: {},
      revision: 2,
      state: { two: 2, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    IN_MEMORY_VIEW_STORE.push({
      ...identifier,
      id: view3,
      destroyed: false,
      processed_causation_ids: [],
      hash: randomString(16),
      meta: {},
      revision: 3,
      state: { three: 3, common: "uncommon" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    IN_MEMORY_VIEW_STORE.push({
      ...identifier,
      id: randomUUID(),
      destroyed: true,
      processed_causation_ids: [],
      hash: randomString(16),
      meta: {},
      revision: 4,
      state: { four: 4, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  test("should find", async () => {
    await expect(repository.find({ state: { common: "common" } })).resolves.toStrictEqual([
      {
        id: view1,
        state: { one: 1, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
      {
        id: view2,
        state: { two: 2, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toStrictEqual({
      id: view3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ id: view1 })).resolves.toStrictEqual({
      id: view1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
