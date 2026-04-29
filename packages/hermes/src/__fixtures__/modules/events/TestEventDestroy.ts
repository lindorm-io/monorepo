import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventDestroy {
  public constructor(public readonly input: string) {}
}
