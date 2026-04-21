import type { PylonSecurityTxt } from "../../types/index.js";

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const renderSecurityTxt = (input: PylonSecurityTxt): string => {
  const lines: Array<string> = [];

  const contacts = Array.isArray(input.contact) ? input.contact : [input.contact];

  for (const contact of contacts) {
    lines.push(`Contact: ${contact}`);
  }

  lines.push(`Expires: ${toIso(input.expires)}`);

  if (input.acknowledgments !== undefined) {
    lines.push(`Acknowledgments: ${input.acknowledgments}`);
  }

  if (input.canonical !== undefined) {
    lines.push(`Canonical: ${input.canonical}`);
  }

  if (input.encryption !== undefined) {
    lines.push(`Encryption: ${input.encryption}`);
  }

  if (input.hiring !== undefined) {
    lines.push(`Hiring: ${input.hiring}`);
  }

  if (input.policy !== undefined) {
    lines.push(`Policy: ${input.policy}`);
  }

  if (input.preferredLanguages !== undefined) {
    lines.push(`Preferred-Languages: ${input.preferredLanguages.join(", ")}`);
  }

  return `${lines.join("\n")}\n`;
};
