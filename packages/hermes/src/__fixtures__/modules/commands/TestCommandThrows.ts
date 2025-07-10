import { Command } from "../../../decorators";

@Command()
export class TestCommandThrows {
  public constructor(public readonly input: any) {}
}
