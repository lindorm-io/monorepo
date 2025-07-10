import { Event } from "../../../decorators";

@Event()
export class TestEventCreate {
  public constructor(public readonly input: any) {}
}
