import { Event } from "../../../decorators";

@Event()
export class TestEventDestroy {
  public constructor(public readonly input: any) {}
}
