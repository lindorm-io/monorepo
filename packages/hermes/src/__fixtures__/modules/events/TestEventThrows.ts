import { Event } from "../../../decorators";

@Event()
export class TestEventThrows {
  public constructor(public readonly input: any) {}
}
