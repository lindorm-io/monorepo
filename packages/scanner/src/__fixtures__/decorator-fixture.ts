if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol("Symbol.metadata");
}

type ClassDecoratorContext<T = unknown> = {
  kind: "class";
  name: string | undefined;
  metadata: Record<PropertyKey, unknown>;
  addInitializer(fn: (this: T) => void): void;
};

const tag = (value: string) => {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext<T>,
  ): T {
    context.metadata.tag = value;
    return target;
  };
};

@tag("decorated-fallback")
export class Decorated {
  public readonly alias = "decorated-fixture";
}

export const created = new Decorated();
