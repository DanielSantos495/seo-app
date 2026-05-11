/* eslint-disable react/prop-types */
// Lista reutilizable de issues SEO.
// Funciona con cualquier entidad (productos, páginas, colecciones) siempre que
// los issues sigan el formato { field, impact, message, fix, meta? } que
// produce `analyzeProduct` en seo-analyzer.js.

const IMPACT_TONE = {
  high: "critical",
  medium: "caution",
  low: "info",
};

const IMPACT_LABEL = {
  high: "Crítico",
  medium: "Medio",
  low: "Bajo",
};

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };

export default function IssuesList({ issues = [], editUrl }) {
  if (issues.length === 0) {
    return (
      <s-banner tone="success" heading="Sin issues detectados">
        <s-paragraph>Excelente trabajo — este contenido cumple con los criterios SEO.</s-paragraph>
      </s-banner>
    );
  }

  const editUrls = {
    "seo.title": `${editUrl}#seo`,
    "seo.description": `${editUrl}#seo`,
    "descriptionHtml": `${editUrl}`,
  }

  const sorted = [...issues].sort(
    (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact],
  );

  return (
    <s-stack direction="block" gap="base">
      {sorted.map((issue, idx) => (
        <s-box
          key={`${issue.field}-${idx}`}
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack direction="block" gap="tight">
            <s-stack direction="inline" gap="tight" alignment="center">
              <s-badge tone={IMPACT_TONE[issue.impact]}>
                {IMPACT_LABEL[issue.impact]}
              </s-badge>
              <s-text>{issue.message}</s-text>
            </s-stack>
            <s-text tone="subdued">{issue.fix}</s-text>
            {editUrl && (
              <s-link href={editUrls[issue.field] || editUrl}>Arreglar en Shopify →</s-link>
            )}
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
