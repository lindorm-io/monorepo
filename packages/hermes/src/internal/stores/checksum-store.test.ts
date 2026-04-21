import { findChecksum, insertChecksum } from "./checksum-store.js";
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

describe("findChecksum", () => {
  it("should call repo.findOne with eventId", async () => {
    const repo = createMockRepo();
    const mockChecksum = { eventId: "event-1", checksum: "abc123" };
    repo.findOne.mockResolvedValue(mockChecksum);

    const result = await findChecksum(repo as any, "event-1");

    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(repo.findOne).toHaveBeenCalledWith({ eventId: "event-1" });
    expect(result).toBe(mockChecksum);
  });

  it("should return null when checksum is not found", async () => {
    const repo = createMockRepo();

    const result = await findChecksum(repo as any, "event-missing");

    expect(result).toBeNull();
  });
});

describe("insertChecksum", () => {
  it("should call repo.insert with the record", async () => {
    const repo = createMockRepo();
    const record = { eventId: "event-1", checksum: "abc123" } as any;
    repo.insert.mockResolvedValue(record);

    const result = await insertChecksum(repo as any, record);

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(record);
    expect(result).toBe(record);
  });
});
