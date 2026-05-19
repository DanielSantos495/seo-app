// Mapeo de field técnico (que produce `analyzeProduct`) → label humano.
// Usado por la vista global de issues y opcionalmente por `IssuesList`.

export const ISSUE_LABELS = {
  "seo.title": "Meta title",
  "seo.description": "Meta description",
  "images.altText": "Image alt text",
  descriptionHtml: "Product description",
  handle: "URL handle",
};

export function labelForField(field) {
  return ISSUE_LABELS[field] || field;
}

// Devuelve el más severo entre dos impacts. Útil al agrupar issues del mismo
// field con impacts distintos (ej. descriptionHtml puede ser high o medium).
const SEVERITY = { high: 3, medium: 2, low: 1 };

export function mostSevere(a, b) {
  if (!a) return b;
  if (!b) return a;
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}
