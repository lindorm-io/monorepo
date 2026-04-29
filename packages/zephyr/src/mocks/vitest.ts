import { vi, type Mocked } from "vitest";
import type { IZephyr } from "../interfaces/Zephyr.js";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom.js";
import { _createMockZephyr } from "./create-mock-zephyr.js";
import { _createMockZephyrRoom } from "./create-mock-zephyr-room.js";

type MockZephyr = Mocked<IZephyr>;
type MockZephyrRoom = Mocked<IZephyrRoom>;

export const createMockZephyr = (): MockZephyr => _createMockZephyr(vi.fn) as MockZephyr;

export const createMockZephyrRoom = (name?: string): MockZephyrRoom =>
  _createMockZephyrRoom(vi.fn, name) as MockZephyrRoom;
