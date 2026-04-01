import { Event } from "../../../decorators";

@Event()
export class TestEventUpcast_V2 {
  public constructor(
    public readonly value: string,
    public readonly addedField: number,
  ) {}
}
