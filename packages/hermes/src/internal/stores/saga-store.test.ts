import { loadSaga, saveSaga, clearMessages } from "./saga-store";

const createMockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(false),
});

const sagaIdentifier = {
  id: "saga-id-456",
  name: "test_saga",
  namespace: "test",
};

describe("loadSaga", () => {
  it("should call repo.findOne with composite key", async () => {
    const repo = createMockRepo();
    const mockSaga = { id: "saga-id-456", name: "test_saga" };
    repo.findOne.mockResolvedValue(mockSaga);

    const result = await loadSaga(repo as any, sagaIdentifier);

    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(repo.findOne).toHaveBeenCalledWith({
      id: "saga-id-456",
      name: "test_saga",
      namespace: "test",
    });
    expect(result).toBe(mockSaga);
  });

  it("should return null when saga is not found", async () => {
    const repo = createMockRepo();

    const result = await loadSaga(repo as any, sagaIdentifier);

    expect(result).toBeNull();
  });
});

describe("saveSaga", () => {
  it("should call repo.save with the saga record", async () => {
    const repo = createMockRepo();
    const saga = { id: "saga-id-456", name: "test_saga" } as any;
    repo.save.mockResolvedValue(saga);

    const result = await saveSaga(repo as any, saga);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(saga);
    expect(result).toBe(saga);
  });
});

describe("clearMessages", () => {
  it("should set messagesToDispatch to empty array and call repo.update", async () => {
    const repo = createMockRepo();
    const saga = {
      id: "saga-id-456",
      messagesToDispatch: [{ type: "command", data: {} }],
    } as any;
    repo.update.mockResolvedValue(saga);

    const result = await clearMessages(repo as any, saga);

    expect(saga.messagesToDispatch).toEqual([]);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(saga);
    expect(result).toBe(saga);
  });
});
