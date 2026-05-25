// Helpers puros para serializar el reporte SEO a CSV (RFC 4180).

const HEADERS = [
  "Product ID",
  "Title",
  "Handle",
  "Score",
  "Issues Total",
  "Critical",
  "Medium",
  "Low",
  "Issue Fields",
];

// Envuelve en comillas y escapa si el valor contiene `,`, `"`, CR o LF.
export function escapeCell(value) {
  const str = value == null ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(items) {
  const rows = [HEADERS.map(escapeCell).join(",")];

  for (const item of items) {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const i of item.issues || []) counts[i.impact]++;
    const fields = (item.issues || []).map((i) => i.field).join(" | ");

    rows.push(
      [
        item.productId,
        item.title,
        item.handle,
        item.score ?? "",
        (item.issues || []).length,
        counts.high,
        counts.medium,
        counts.low,
        fields,
      ]
        .map(escapeCell)
        .join(","),
    );
  }

  return rows.join("\r\n");
}
