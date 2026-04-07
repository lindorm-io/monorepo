import type { IZephyr } from "../interfaces/Zephyr";
import { createMockZephyrRoom } from "./create-mock-zephyr-room";

export type MockZephyr = jest.Mocked<IZephyr>;

export const createMockZephyr = (): MockZephyr => ({
  id: "mock-id",
  connected: true,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  room: jest.fn().mockImplementation((name: string) => createMockZephyrRoom(name)),
  onConnect: jest.fn(),
  onDisconnect: jest.fn(),
  onError: jest.fn(),
  onReconnect: jest.fn(),
});
