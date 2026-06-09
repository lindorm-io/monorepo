import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { MetaField, MetaHeader } from "../types/metadata.js";

const RESERVED_TRANSPORT_HEADERS = new Set([
  "content-type",
  "content-encoding",
  "correlation-id",
  "reply-to",
  "message-id",
  "timestamp",
  "type",
  "delivery-mode",
  "priority",
  "expiration",
]);

export const validateHeaders = (
  targetName: string,
  headers: Array<MetaHeader>,
  fields: Array<MetaField>,
): void => {
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const seenHeaderNames = new Set<string>();

  for (const header of headers) {
    const field = fieldMap.get(header.key);

    if (!field) {
      throw new IrisMetadataError(
        `@Header on property "${header.key}" requires a @Field decorator`,
        {
          code: "header_without_field",
          title: "Header Without Field",
          details:
            "A @Header decorator was applied to a property that has no @Field decorator. Add a @Field decorator to the property.",
          debug: { target: targetName, property: header.key },
        },
      );
    }

    if (field.type === "array" || field.type === "object") {
      throw new IrisMetadataError(
        `@Header cannot be used on array or object fields (field "${field.key}" has type "${field.type}")`,
        {
          code: "header_unsupported_field_type",
          title: "Header Unsupported Field Type",
          details:
            "A @Header was applied to a field whose type is array or object. Headers may only be used on scalar field types.",
          debug: { target: targetName, property: field.key, type: field.type },
        },
      );
    }

    if (field.transform != null) {
      throw new IrisMetadataError(
        `@Header and @Transform cannot be used on the same field "${field.key}"`,
        {
          code: "header_transform_conflict",
          title: "Header Transform Conflict",
          details:
            "A field uses both @Header and @Transform, which is not allowed. Remove one of the two decorators from the field.",
          debug: { target: targetName, property: field.key },
        },
      );
    }

    const normalised = header.headerName.toLowerCase();

    if (normalised.startsWith("x-iris-")) {
      throw new IrisMetadataError(
        `Header name '${header.headerName}' uses reserved 'x-iris-' prefix`,
        {
          code: "reserved_header_prefix",
          title: "Reserved Header Prefix",
          details:
            "A custom header name uses the reserved 'x-iris-' prefix, which is owned by the transport layer. Choose a different header name.",
          debug: {
            target: targetName,
            property: header.key,
            headerName: header.headerName,
          },
        },
      );
    }

    if (RESERVED_TRANSPORT_HEADERS.has(normalised)) {
      throw new IrisMetadataError(
        `Header name '${header.headerName}' conflicts with reserved transport header`,
        {
          code: "reserved_transport_header",
          title: "Reserved Transport Header",
          details:
            "A custom header name collides with a reserved transport header such as content-type or message-id. Choose a different header name.",
          debug: {
            target: targetName,
            property: header.key,
            headerName: header.headerName,
          },
        },
      );
    }

    if (seenHeaderNames.has(normalised)) {
      throw new IrisMetadataError("Duplicate header name", {
        code: "duplicate_header_name",
        title: "Duplicate Header Name",
        details:
          "Two @Header decorators map to the same header name (case-insensitive). Give each header a unique name.",
        debug: { target: targetName, headerName: header.headerName },
      });
    }
    seenHeaderNames.add(normalised);
  }
};
