import { CborError } from "../../errors/index.js";
import type { CborKitSettings } from "../../types/cbor-field.js";
import type { ResolvedCborField, ResolvedCborSpec } from "../types/resolved-cbor-spec.js";

const buildReverseEnum = (map: Record<string, number>): Record<number, string> => {
  const reverse: Record<number, string> = {};

  for (const [key, code] of Object.entries(map)) {
    if (reverse[code] !== undefined) {
      throw new CborError("Duplicate enum wire code", {
        code: "invalid_enum_config",
        title: "Invalid Enum Config",
        details: `The enum maps both "${reverse[code]}" and "${key}" to the wire code ${code}; every code must be unique.`,
      });
    }

    reverse[code] = key;
  }

  return reverse;
};

const resolveField = (field: ResolvedCborField): ResolvedCborField => {
  if (!Number.isInteger(field.label)) {
    throw new CborError("Invalid field label", {
      code: "invalid_label",
      title: "Invalid Field Label",
      details: `Field "${field.key}" has a non-integer label; wire labels must be integers.`,
    });
  }

  if (field.label <= 0) {
    throw new CborError("Reserved field label", {
      code: "invalid_label",
      title: "Invalid Field Label",
      details: `Field "${field.key}" uses label ${field.label}; labels must be > 0 (label 0 is reserved for the version tag).`,
    });
  }

  const isEnum = field.kind === "enum";

  if (isEnum !== (field.enum !== undefined)) {
    throw new CborError("Invalid enum config", {
      code: "invalid_enum_config",
      title: "Invalid Enum Config",
      details: isEnum
        ? `Field "${field.key}" has kind "enum" but no "enum" map; an enum map is required.`
        : `Field "${field.key}" defines an "enum" map but its kind is "${field.kind}"; "enum" is only valid for kind "enum".`,
    });
  }

  const isBespoke = field.kind === "bespoke";

  if (isBespoke !== (field.encode !== undefined && field.decode !== undefined)) {
    throw new CborError("Invalid bespoke config", {
      code: "invalid_bespoke_config",
      title: "Invalid Bespoke Config",
      details: isBespoke
        ? `Field "${field.key}" has kind "bespoke" but is missing "encode" and/or "decode"; both are required.`
        : `Field "${field.key}" defines "encode"/"decode" but its kind is "${field.kind}"; those are only valid for kind "bespoke".`,
    });
  }

  if (
    field.encoding !== undefined &&
    field.kind !== "bstr" &&
    field.kind !== "bstrArray"
  ) {
    throw new CborError("Invalid encoding config", {
      code: "invalid_encoding_config",
      title: "Invalid Encoding Config",
      details: `Field "${field.key}" sets "encoding" but its kind is "${field.kind}"; "encoding" is only valid for "bstr" / "bstrArray".`,
    });
  }

  return isEnum ? { ...field, reverseEnum: buildReverseEnum(field.enum!) } : field;
};

export const resolveCborSpec = (settings: CborKitSettings): ResolvedCborSpec => {
  const byLabel = new Map<number, ResolvedCborField>();

  const fields = settings.fields.map((field) => {
    const resolved = resolveField(field);

    if (settings.version && resolved.label === settings.version.label) {
      throw new CborError("Field label collides with version label", {
        code: "duplicate_label",
        title: "Duplicate Label",
        details: `Field "${resolved.key}" uses label ${resolved.label}, which is reserved by the version tag.`,
      });
    }

    if (byLabel.has(resolved.label)) {
      throw new CborError("Duplicate field label", {
        code: "duplicate_label",
        title: "Duplicate Label",
        details: `Label ${resolved.label} is used by more than one field; every field must have a unique label.`,
      });
    }

    byLabel.set(resolved.label, resolved);

    return resolved;
  });

  return { version: settings.version, mode: settings.mode ?? "strict", fields, byLabel };
};
