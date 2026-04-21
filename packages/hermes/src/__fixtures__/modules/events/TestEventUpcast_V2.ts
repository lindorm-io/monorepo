import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventUpcast_V2 {
  public constructor(
    public readonly value: string,
    public readonly addedField: number,
  ) {}
}
