import { Event } from "../../../decorators";

@Event()
export class TestEventDestroyNext {
  public constructor(public readonly input: any) {}
}
