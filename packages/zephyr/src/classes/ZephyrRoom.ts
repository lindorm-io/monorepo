import type { IZephyr } from "../interfaces/Zephyr";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom";

export class ZephyrRoom implements IZephyrRoom {
  public readonly name: string;

  private readonly zephyr: IZephyr<any>;

  public constructor(zephyr: IZephyr<any>, name: string) {
    this.zephyr = zephyr;
    this.name = name;
  }

  public async join(): Promise<void> {
    await this.zephyr.request(`rooms:${this.name}:join`);
  }

  public async leave(): Promise<void> {
    await this.zephyr.request(`rooms:${this.name}:leave`);
  }

  public async emit(event: string, data?: any): Promise<void> {
    await this.zephyr.emit(`rooms:${this.name}:${event}`, data);
  }

  public on(event: string, handler: (data: any) => void): void {
    this.zephyr.on(`rooms:${this.name}:${event}`, handler);
  }

  public off(event: string, handler?: (data: any) => void): void {
    this.zephyr.off(`rooms:${this.name}:${event}`, handler);
  }
}
