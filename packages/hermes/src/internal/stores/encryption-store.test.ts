import { findEncryptionKey, insertEncryptionKey } from "./encryption-store";

const createMockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(false),
});

describe("findEncryptionKey", () => {
  it("should call repo.findOne with aggregate fields", async () => {
    const repo = createMockRepo();
    const mockRecord = { aggregateId: "agg-1", key: "enc-key" };
    repo.findOne.mockResolvedValue(mockRecord);

    const result = await findEncryptionKey(
      repo as any,
      "agg-1",
      "test_aggregate",
      "test",
    );

    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(repo.findOne).toHaveBeenCalledWith({
      aggregateId: "agg-1",
      aggregateName: "test_aggregate",
      aggregateNamespace: "test",
    });
    expect(result).toBe(mockRecord);
  });

  it("should return null when encryption key is not found", async () => {
    const repo = createMockRepo();

    const result = await findEncryptionKey(
      repo as any,
      "agg-missing",
      "test_aggregate",
      "test",
    );

    expect(result).toBeNull();
  });
});

describe("insertEncryptionKey", () => {
  it("should call repo.insert with the record", async () => {
    const repo = createMockRepo();
    const record = {
      aggregateId: "agg-1",
      aggregateName: "test_aggregate",
      aggregateNamespace: "test",
      key: "enc-key",
    } as any;
    repo.insert.mockResolvedValue(record);

    const result = await insertEncryptionKey(repo as any, record);

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(record);
    expect(result).toBe(record);
  });
});
