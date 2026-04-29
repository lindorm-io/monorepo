import { causationExists, insertCausation, findCausations } from "./causation-store.js";
import { describe, expect, it, vi } from "vitest";

const createMockRepo = () => ({
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  insert: vi.fn().mockResolvedValue(undefined),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  count: vi.fn().mockResolvedValue(0),
  exists: vi.fn().mockResolvedValue(false),
});

describe("causationExists", () => {
  it("should call repo.exists with correct args", async () => {
    const repo = createMockRepo();
    repo.exists.mockResolvedValue(true);

    const result = await causationExists(
      repo as any,
      "owner-id-1",
      "test_aggregate",
      "causation-id-1",
    );

    expect(repo.exists).toHaveBeenCalledTimes(1);
    expect(repo.exists).toHaveBeenCalledWith({
      ownerId: "owner-id-1",
      ownerName: "test_aggregate",
      causationId: "causation-id-1",
    });
    expect(result).toBe(true);
  });

  it("should return false when causation does not exist", async () => {
    const repo = createMockRepo();

    const result = await causationExists(
      repo as any,
      "owner-id-1",
      "test_aggregate",
      "causation-id-missing",
    );

    expect(result).toBe(false);
  });
});

describe("insertCausation", () => {
  it("should call repo.insert with the record", async () => {
    const repo = createMockRepo();
    const record = {
      ownerId: "owner-id-1",
      ownerName: "test_aggregate",
      causationId: "causation-id-1",
    } as any;
    repo.insert.mockResolvedValue(record);

    const result = await insertCausation(repo as any, record);

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(record);
    expect(result).toBe(record);
  });
});

describe("findCausations", () => {
  it("should call repo.find with ownerId and ownerName", async () => {
    const repo = createMockRepo();
    const mockCausations = [{ causationId: "c1" }, { causationId: "c2" }];
    repo.find.mockResolvedValue(mockCausations);

    const result = await findCausations(repo as any, "owner-id-1", "test_aggregate");

    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(repo.find).toHaveBeenCalledWith({
      ownerId: "owner-id-1",
      ownerName: "test_aggregate",
    });
    expect(result).toBe(mockCausations);
  });
});
