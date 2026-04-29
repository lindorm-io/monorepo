import type { IZephyrRoom } from "../interfaces/ZephyrRoom.js";

export const _createMockZephyrRoom = (
  mockFn: () => any,
  name = "mock-room",
): IZephyrRoom => {
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    name,
    join: resolves(undefined),
    leave: resolves(undefined),
    emit: resolves(undefined),
    on: mockFn(),
    off: mockFn(),
  } as unknown as IZephyrRoom;
};
