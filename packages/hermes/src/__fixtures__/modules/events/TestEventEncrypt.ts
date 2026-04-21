import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventEncrypt {
  public constructor(public readonly input: string) {}
}
