import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventUpcast_V1 {
  public constructor(public readonly value: string) {}
}
