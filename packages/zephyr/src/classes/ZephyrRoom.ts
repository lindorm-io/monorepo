import type { IZephyr } from "../interfaces/Zephyr.js";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom.js";

export class ZephyrRoom implements IZephyrRoom {
  readonly name: string;

  private readonly zephyr: IZephyr<any>;

  constructor(zephyr: IZephyr<any>, name: string) {
    this.zephyr = zephyr;
    this.name = name;
  }

  async join(): Promise<void> {
    await this.zephyr.request(`rooms:${this.name}:join`);
  }

  async leave(): Promise<void> {
    await this.zephyr.request(`rooms:${this.name}:leave`);
  }

  async emit(event: string, data?: any): Promise<void> {
    await this.zephyr.emit(`rooms:${this.name}:${event}`, data);
  }

  on(event: string, handler: (data: any) => void): void {
    this.zephyr.on(`rooms:${this.name}:${event}`, handler);
  }

  off(event: string, handler?: (data: any) => void): void {
    this.zephyr.off(`rooms:${this.name}:${event}`, handler);
  }
}
