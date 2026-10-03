import { AbstractSteps, Inject } from "@lindorm/gherkin";
import { expect } from "vitest";
import { KryptosError } from "../errors/index.js";
import { KryptosContext } from "./kryptos-context.js";

export type KeyFormat = "b64" | "der" | "jwk" | "pem";

export type Subject = "kryptos" | "other";

const caughtBy = (act: () => unknown): unknown => {
  try {
    act();
  } catch (error) {
    return error;
  }

  return undefined;
};

@AbstractSteps()
export abstract class KryptosStepsBase {
  @Inject(KryptosContext) protected readonly ctx!: KryptosContext;

  protected attempt(act: () => unknown): void {
    this.ctx.caught = caughtBy(act);
  }

  protected refused(code: string, act: () => unknown): void {
    this.expectRefusal(code, caughtBy(act));
  }

  protected expectRefusal(code: string, caught: unknown): void {
    expect(caught).toBeInstanceOf(KryptosError);
    expect(caught).toMatchObject({ code });
  }

  protected unwrapPem(pem: string): string {
    return pem
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replace(/\s/g, "");
  }
}
