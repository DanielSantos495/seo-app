/* eslint-disable react/prop-types */
import { useEffect } from "react";

// Banner persistente que muestra el resumen de un bulk fix recién terminado.
// El toast es efímero (4s) y se pierde — si el merchant arregló 200 productos
// con 3 errores, necesita poder revisar esos 3 sin recargar.
//
// Se controla con state local en el padre: cuando un job termina, el padre
// guarda el `resultSummary` y renderiza este banner. El usuario lo cierra
// explícitamente con "Entendido".

export default function BulkFixSummaryBanner({ summary, onDismiss }) {
  // Scroll smooth al top cuando aparece el banner para que el merchant lo
  // vea aunque estuviera en la mitad de la tabla de productos.
  useEffect(() => {
    if (summary) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [summary]);

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
      <s-banner tone="info" heading="Sin cambios">
        <s-paragraph>No había alt texts para agregar.</s-paragraph>
        <s-button slot="primaryAction" onClick={onDismiss}>
          Entendido
        </s-button>
      </s-banner>
    );
  }

  if (isAlreadyOk) {
    return (
      <s-banner tone="success" heading="Listado actualizado">
        <s-paragraph>
          Esos {totalProducts} producto{totalProducts === 1 ? "" : "s"} ya{" "}
          tenía{totalProducts === 1 ? "" : "n"} alt text en todas sus imágenes
          (probablemente imágenes compartidas con productos arreglados en este
          mismo job). Sincronizamos el listado.
        </s-paragraph>
        <s-button slot="primaryAction" onClick={onDismiss}>
          Entendido
        </s-button>
      </s-banner>
    );
  }

  return (
    <s-banner
      tone={hasErrors ? "warning" : "success"}
      heading={
        hasErrors
          ? `Listo con ${errors.length} error${errors.length === 1 ? "" : "es"}`
          : "Bulk fix completado"
      }
    >
      <s-paragraph>
        {okCount} producto{okCount === 1 ? "" : "s"} actualizado
        {okCount === 1 ? "" : "s"} · {totalImages} alt text
        {totalImages === 1 ? "" : "s"} agregado{totalImages === 1 ? "" : "s"}.
      </s-paragraph>

      {hasErrors && (
        <s-stack direction="block" gap="tight">
          <s-text tone="subdued">Productos con error:</s-text>
          {errors.slice(0, 10).map((e, idx) => (
            <s-text key={idx} tone="critical">
              · {e.message}
            </s-text>
          ))}
          {errors.length > 10 && (
            <s-text tone="subdued">
              … y {errors.length - 10} error{errors.length - 10 === 1 ? "" : "es"} más
            </s-text>
          )}
        </s-stack>
      )}

      <s-button slot="primaryAction" onClick={onDismiss}>
        Entendido
      </s-button>
    </s-banner>
  );
}
