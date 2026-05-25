// Lógica pura de scoring SEO por producto.
// Sin dependencias externas — fácil de testear.
//
// Checklist interno (no es el score real de Google ni una estimación de
// ranking): suma 100 puntos si TODOS los campos auditados están bien.
// Es una métrica de completitud técnica del catálogo, no una promesa de
// posicionamiento.
//
// Reglas (max 100):
//   - Meta title presente:        25 pts (-10 si longitud fuera de 50–60)
//   - Meta description presente:  25 pts (-10 si longitud fuera de 120–160)
//   - Todas las imágenes con alt: 20 pts
//   - Descripción > 100 chars:    20 pts
//   - Handle amigable:            10 pts

const META_TITLE_MIN = 50;
const META_TITLE_MAX = 60;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;
const DESCRIPTION_MIN_CHARS = 100;

// Slug válido: minúsculas, números y guiones simples.
const HANDLE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Heurística para detectar handles auto-generados por Shopify (terminan en sufijos numéricos largos).
const AUTO_HANDLE_SUFFIX = /-\d{5,}$/;

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, "").trim();
}

export function analyzeProduct(product) {
  const issues = [];
  let score = 0;

  const seoTitle = (product.seo?.title || "").trim();
  const seoDescription = (product.seo?.description || "").trim();
  const descriptionPlain = stripHtml(product.descriptionHtml);
  const images = product.images || [];
  const handle = product.handle || "";

  // 1. Meta title
  if (seoTitle) {
    score += 25;
    if (seoTitle.length < META_TITLE_MIN || seoTitle.length > META_TITLE_MAX) {
      score -= 10;
      issues.push({
        field: "seo.title",
        impact: "medium",
        message: `Meta title is ${seoTitle.length} characters (ideal: ${META_TITLE_MIN}–${META_TITLE_MAX}).`,
        fix: `Keep the SEO title between ${META_TITLE_MIN} and ${META_TITLE_MAX} characters so Google doesn't truncate it.`,
      });
    }
  } else {
    issues.push({
      field: "seo.title",
      impact: "high",
      message: "Meta title is missing.",
      fix: `Add an SEO title between ${META_TITLE_MIN} and ${META_TITLE_MAX} characters.`,
    });
  }

  // 2. Meta description
  if (seoDescription) {
    score += 25;
    if (
      seoDescription.length < META_DESC_MIN ||
      seoDescription.length > META_DESC_MAX
    ) {
      score -= 10;
      issues.push({
        field: "seo.description",
        impact: "medium",
        message: `Meta description is ${seoDescription.length} characters (ideal: ${META_DESC_MIN}–${META_DESC_MAX}).`,
        fix: `Rewrite the meta description between ${META_DESC_MIN} and ${META_DESC_MAX} characters.`,
      });
    }
  } else {
    issues.push({
      field: "seo.description",
      impact: "high",
      message: "Meta description is missing.",
      fix: `Add a meta description between ${META_DESC_MIN} and ${META_DESC_MAX} characters.`,
    });
  }

  // 3. Alt texts en imágenes
  if (images.length === 0) {
    // Sin imágenes no hay nada que penalizar — otorgamos los puntos.
    score += 20;
  } else {
    const missingAlt = images.filter((img) => !img.altText?.trim());
    if (missingAlt.length === 0) {
      score += 20;
    } else {
      issues.push({
        field: "images.altText",
        impact: "medium",
        message: `${missingAlt.length} of ${images.length} images missing alt text.`,
        fix: "Add descriptive alt text to each image — key for image SEO and accessibility.",
        meta: { missingImageIds: missingAlt.map((i) => i.id) },
      });
    }
  }

  // 4. Descripción del producto
  if (descriptionPlain.length > DESCRIPTION_MIN_CHARS) {
    score += 20;
  } else {
    issues.push({
      field: "descriptionHtml",
      impact: descriptionPlain.length === 0 ? "high" : "medium",
      message:
        descriptionPlain.length === 0
          ? "This product has no description."
          : `Description is too short (${descriptionPlain.length} characters).`,
      fix: `Write at least ${DESCRIPTION_MIN_CHARS} characters of real description (excluding HTML).`,
    });
  }

  // 5. Handle / URL amigable
  const handleOk =
    HANDLE_REGEX.test(handle) && !AUTO_HANDLE_SUFFIX.test(handle);
  if (handleOk) {
    score += 10;
  } else {
    issues.push({
      field: "handle",
      impact: "low",
      message: `The handle "${handle}" isn't optimal for SEO.`,
      fix: "Use only lowercase letters, numbers, and hyphens. Avoid IDs or timestamps in the URL.",
    });
  }

  return {
    productId: product.id,
    title: product.title,
    handle: product.handle,
    score: clamp(score, 0, 100),
    issues,
  };
}

// Agrega un conjunto de análisis individuales en un report.
// Los `analyses` deben tener el shape de `analyzeProduct`: { score, issues, ... }.
// Útil para reusar desde el cache sin re-analizar desde productos crudos.
export function aggregateAnalyses(analyses) {
  const total = analyses.length;
  const overallScore =
    total === 0
      ? 0
      : Math.round(analyses.reduce((sum, a) => sum + a.score, 0) / total);

  const issuesByImpact = { high: 0, medium: 0, low: 0 };
  for (const analysis of analyses) {
    for (const issue of analysis.issues) {
      issuesByImpact[issue.impact]++;
    }
  }

  return {
    overallScore,
    totalProducts: total,
    issuesByImpact,
    products: analyses,
  };
}

// Atajo: analiza los productos crudos y los agrega.
export function analyzeProducts(products) {
  return aggregateAnalyses(products.map(analyzeProduct));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
