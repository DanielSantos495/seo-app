/* eslint-disable react/prop-types */
// Banner persistente que muestra el resumen de un bulk fix recién terminado.
// El toast es efímero (4s) y se pierde — si el merchant arregló 200 productos
// con 3 errores, necesita poder revisar esos 3 sin recargar.
//
// Se controla con state local en el padre: cuando un job termina, el padre
// guarda el `resultSummary` y renderiza este banner. El usuario lo cierra
// explícitamente con "Entendido".

export default function BulkFixSummaryBanner({ summary, onDismiss }) {
  if (!summary) return null;

  const { totalProducts = 0, totalImages = 0, errors = [] } = summary;
  const okCount = totalProducts - errors.length;
  const hasErrors = errors.length > 0;
  const isEmpty = totalImages === 0 && totalProducts === 0;
  // Todos los productos ya tenían alt al momento del fetch (caso típico:
  // imágenes compartidas que se arreglaron desde otro producto en el mismo
  // job). El cache se sincroniza igual.
  const isAlreadyOk =
    totalImages === 0 && totalProducts > 0 && !hasErrors;

  if (isEmpty) {
    return (
      <s-banner tone="info" heading="No changes">
        <s-paragraph>No alt texts to add.</s-paragraph>
        <s-button slot="primaryAction" onClick={onDismiss}>
          Got it
        </s-button>
      </s-banner>
    );
  }

  if (isAlreadyOk) {
    return (
      <s-banner tone="success" heading="List updated">
        <s-paragraph>
          Those {totalProducts} product{totalProducts === 1 ? "" : "s"} already
          had alt text on all images (likely because they share images with
          products fixed in this same job). The list is now in sync.
        </s-paragraph>
        <s-button slot="primaryAction" onClick={onDismiss}>
          Got it
        </s-button>
      </s-banner>
    );
  }

  return (
    <s-banner
      tone={hasErrors ? "warning" : "success"}
      heading={
        hasErrors
          ? `Completed with ${errors.length} error${errors.length === 1 ? "" : "s"}`
          : "Bulk fix completed"
      }
    >
      <s-paragraph>
        {okCount} product{okCount === 1 ? "" : "s"} updated · {totalImages} alt
        text{totalImages === 1 ? "" : "s"} added.
      </s-paragraph>

      {hasErrors && (
        <s-stack direction="block" gap="small-300">
          <s-text tone="subdued">Products with errors:</s-text>
          {errors.slice(0, 10).map((e, idx) => (
            <s-text key={idx} tone="critical">
              · {e.message}
            </s-text>
          ))}
          {errors.length > 10 && (
            <s-text tone="subdued">
              …and {errors.length - 10} more error{errors.length - 10 === 1 ? "" : "s"}
            </s-text>
          )}
        </s-stack>
      )}

      <s-button slot="primaryAction" onClick={onDismiss}>
        Got it
      </s-button>
    </s-banner>
  );
}
