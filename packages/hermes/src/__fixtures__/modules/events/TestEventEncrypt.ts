import { Event } from "../../../decorators";

@Event()
export class TestEventEncrypt {
  public constructor(public readonly input: any) {}
}
