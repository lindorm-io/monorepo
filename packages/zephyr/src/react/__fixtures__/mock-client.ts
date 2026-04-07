import type { IZephyr } from "../../interfaces/Zephyr";

export const createMockClient = (): jest.Mocked<IZephyr> => ({
  id: "mock-id",
  connected: true,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  room: jest.fn().mockReturnValue({
    name: "mock-room",
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
  }),
  onConnect: jest.fn(),
  onDisconnect: jest.fn(),
  onError: jest.fn(),
  onReconnect: jest.fn(),
});
