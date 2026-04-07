import type { IZephyrRoom } from "../interfaces/ZephyrRoom";

export type MockZephyrRoom = jest.Mocked<IZephyrRoom>;

export const createMockZephyrRoom = (name = "mock-room"): MockZephyrRoom => ({
  name,
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
});
