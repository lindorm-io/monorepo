import { Event } from "../../../decorators";

@Event()
export class TestEventUpcast_V3 {
  public constructor(
    public readonly value: string,
    public readonly addedField: number,
    public readonly extraField: boolean,
  ) {}
}
