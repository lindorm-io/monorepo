import { Event } from "../../../decorators";

@Event()
export class TestEventTimeout {
  public constructor(public readonly input: any) {}
}
