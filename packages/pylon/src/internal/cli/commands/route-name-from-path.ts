import { pascalCase } from "@lindorm/case";

// Tail-of-the-path route name for generated handler/schema names: the LAST
// static segment pascal-cased, followed by any trailing params as `By<Param>`.
// Leading segments (versions, parents) are deliberately dropped — the feature
// name carries that context.
//
//   /token                      → "Token"
//   /v1/admin/status            → "Status"
//   /v1/users/:id               → "UsersById"
//   /files/*path                → "FilesByPath"
//   /:id (no static segment)    → "ById"
//   /                           → ""
type Segment = { kind: "param" | "static"; name: string };

const parseSegment = (raw: string): Segment => {
  switch (true) {
    case raw.startsWith(":"):
      return { kind: "param", name: raw.slice(1) };
    case raw.startsWith("*"):
      return { kind: "param", name: raw.slice(1) };
    case raw.startsWith("[...") && raw.endsWith("]"):
      return { kind: "param", name: raw.slice(4, -1) };
    case raw.startsWith("[") && raw.endsWith("]"):
      return { kind: "param", name: raw.slice(1, -1) };
    default:
      return { kind: "static", name: raw };
  }
};

export const routeNameFromPath = (path: string): string => {
  const segments = path.split("/").filter(Boolean).map(parseSegment);

  const lastStatic = segments.findLastIndex((segment) => segment.kind === "static");

  const tail = segments.slice(lastStatic === -1 ? 0 : lastStatic);

  return tail
    .map((segment) =>
      segment.kind === "static"
        ? pascalCase(segment.name)
        : "By" + pascalCase(segment.name),
    )
    .join("");
};
