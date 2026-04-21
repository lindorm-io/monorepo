import type { IZephyr } from "../../interfaces/Zephyr";
import { vi, type Mocked } from "vitest";

export const createMockClient = (): Mocked<IZephyr> => ({
  id: "mock-id",
  connected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
  emit: vi.fn().mockResolvedValue(undefined),
  request: vi.fn().mockResolvedValue({}),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  room: vi.fn().mockReturnValue({
    name: "mock-room",
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
  }),
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
  onError: vi.fn(),
  onReconnect: vi.fn(),
  onAuthExpired: vi.fn().mockReturnValue(() => undefined),
});
