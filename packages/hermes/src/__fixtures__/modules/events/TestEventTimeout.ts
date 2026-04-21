import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventTimeout {
  public constructor(public readonly input: string) {}
}
