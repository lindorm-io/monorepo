import { findEvents, insertEvents, countEvents } from "./event-store";

const createMockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(false),
});

const identifier = {
  id: "agg-id-123",
  name: "test_aggregate",
  namespace: "test",
};

describe("findEvents", () => {
  it("should call repo.find with correct filter and order", async () => {
    const repo = createMockRepo();
    const mockEvents = [{ id: "e1" }, { id: "e2" }];
    repo.find.mockResolvedValue(mockEvents);

    const result = await findEvents(repo as any, identifier);

    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(repo.find).toHaveBeenCalledWith(
      {
        aggregateId: "agg-id-123",
        aggregateName: "test_aggregate",
        aggregateNamespace: "test",
      },
      { order: { expectedEvents: "ASC" } },
    );
    expect(result).toBe(mockEvents);
  });
});

describe("insertEvents", () => {
  it("should call repo.insert with the events array", async () => {
    const repo = createMockRepo();
    const events = [{ id: "e1" }, { id: "e2" }] as any;
    repo.insert.mockResolvedValue(events);

    const result = await insertEvents(repo as any, events);

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(events);
    expect(result).toBe(events);
  });
});

describe("countEvents", () => {
  it("should call repo.count with correct filter", async () => {
    const repo = createMockRepo();
    repo.count.mockResolvedValue(5);

    const result = await countEvents(repo as any, identifier);

    expect(repo.count).toHaveBeenCalledTimes(1);
    expect(repo.count).toHaveBeenCalledWith({
      aggregateId: "agg-id-123",
      aggregateName: "test_aggregate",
      aggregateNamespace: "test",
    });
    expect(result).toBe(5);
  });
});
