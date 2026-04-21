import type { IZephyr } from "../interfaces/Zephyr.js";
import { _createMockZephyrRoom } from "./create-mock-zephyr-room.js";

export const _createMockZephyr = (mockFn: () => any): IZephyr => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    id: "mock-id",
    connected: true,
    connect: resolves(undefined),
    disconnect: resolves(undefined),
    refresh: resolves(undefined),
    emit: resolves(undefined),
    request: resolves({}),
    on: mockFn(),
    once: mockFn(),
    off: mockFn(),
    room: impl((name: string) => _createMockZephyrRoom(mockFn, name)),
    onConnect: mockFn(),
    onDisconnect: mockFn(),
    onError: mockFn(),
    onReconnect: mockFn(),
    onAuthExpired: returns(() => undefined),
  } as unknown as IZephyr;
};
