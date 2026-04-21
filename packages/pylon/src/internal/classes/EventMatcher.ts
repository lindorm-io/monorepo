import type { Dict } from "@lindorm/types";
import type { ParsedSegment } from "./PylonScannerBase.js";

export type EventSegment = {
  type: "literal" | "param" | "catchAll";
  value: string;
};

export type MatchedRoute<T> = {
  params: Dict<string>;
  data: Array<T>;
};

type TrieNode<T> = {
  children: Map<string, TrieNode<T>>;
  param: { name: string; node: TrieNode<T> } | null;
  catchAll: { name: string; data: Array<T> } | null;
  data: Array<T>;
};

const createNode = <T>(): TrieNode<T> => ({
  children: new Map(),
  param: null,
  catchAll: null,
  data: [],
});

export class EventMatcher<T> {
  private readonly root: TrieNode<T> = createNode();

  public add(segments: Array<EventSegment>, data: T): void {
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      switch (segment.type) {
        case "literal": {
          let child = node.children.get(segment.value);
          if (!child) {
            child = createNode();
            node.children.set(segment.value, child);
          }
          node = child;
          break;
        }

        case "param": {
          if (!node.param) {
            node.param = { name: segment.value, node: createNode() };
          }
          node = node.param.node;
          break;
        }

        case "catchAll": {
          if (!node.catchAll) {
            node.catchAll = { name: segment.value, data: [] };
          }
          node.catchAll.data.push(data);
          return;
        }
      }
    }

    node.data.push(data);
  }

  public match(event: string): MatchedRoute<T> | null {
    if (!event) return null;

    const parts = event.split(":");
    return this.walk(this.root, parts, 0, {});
  }

  public hasParams(segments: Array<EventSegment>): boolean {
    return segments.some((s) => s.type === "param" || s.type === "catchAll");
  }

  public static parseSegments(
    scannerSegments: Array<ParsedSegment>,
  ): Array<EventSegment> {
    return scannerSegments.map((s) => {
      if (s.isCatchAll || s.isOptionalCatchAll) {
        return { type: "catchAll" as const, value: s.paramName! };
      }
      if (s.isParam) {
        return { type: "param" as const, value: s.paramName! };
      }
      return { type: "literal" as const, value: s.path };
    });
  }

  private walk(
    node: TrieNode<T>,
    parts: Array<string>,
    index: number,
    params: Dict<string>,
  ): MatchedRoute<T> | null {
    if (index === parts.length) {
      if (node.data.length) {
        return { params: { ...params }, data: node.data };
      }
      return null;
    }

    const part = parts[index];

    // 1. Try literal match first (highest priority)
    const literalChild = node.children.get(part);
    if (literalChild) {
      const result = this.walk(literalChild, parts, index + 1, params);
      if (result) return result;
    }

    // 2. Try param match
    if (node.param) {
      const prevValue = params[node.param.name];
      params[node.param.name] = part;

      const result = this.walk(node.param.node, parts, index + 1, params);
      if (result) return result;

      // Backtrack
      if (prevValue !== undefined) {
        params[node.param.name] = prevValue;
      } else {
        delete params[node.param.name];
      }
    }

    // 3. Try catch-all (consumes all remaining segments)
    if (node.catchAll && node.catchAll.data.length) {
      const remaining = parts.slice(index).join(":");
      return {
        params: { ...params, [node.catchAll.name]: remaining },
        data: node.catchAll.data,
      };
    }

    return null;
  }
}
