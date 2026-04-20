import type { IZephyr } from "../interfaces/Zephyr";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom";
import { _createMockZephyr } from "./create-mock-zephyr";
import { _createMockZephyrRoom } from "./create-mock-zephyr-room";

type MockZephyr = jest.Mocked<IZephyr>;
type MockZephyrRoom = jest.Mocked<IZephyrRoom>;

export const createMockZephyr = (): MockZephyr =>
  _createMockZephyr(jest.fn) as MockZephyr;

export const createMockZephyrRoom = (name?: string): MockZephyrRoom =>
  _createMockZephyrRoom(jest.fn, name) as MockZephyrRoom;
