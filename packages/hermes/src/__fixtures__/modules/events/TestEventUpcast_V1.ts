import { Event } from "../../../decorators";

@Event()
export class TestEventUpcast_V1 {
  public constructor(public readonly value: string) {}
}
