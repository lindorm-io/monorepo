import type { IZephyr } from "../interfaces/Zephyr.js";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom.js";
import { _createMockZephyr } from "./create-mock-zephyr.js";
import { _createMockZephyrRoom } from "./create-mock-zephyr-room.js";

type MockZephyr = jest.Mocked<IZephyr>;
type MockZephyrRoom = jest.Mocked<IZephyrRoom>;

export const createMockZephyr = (): MockZephyr =>
  _createMockZephyr(jest.fn) as MockZephyr;

export const createMockZephyrRoom = (name?: string): MockZephyrRoom =>
  _createMockZephyrRoom(jest.fn, name) as MockZephyrRoom;
