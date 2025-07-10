import { Command } from "../../../src";

@Command()
export class ExampleCommandDestroy {
  public constructor(public readonly input: any) {}
}
