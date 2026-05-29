/* eslint-disable react/prop-types */
// Bloque de generación AI para un campo de texto SEO (meta title, meta description,
// descripción). Encapsula el fetcher, el estado de preview editable y el botón Apply.
//
// Props:
//   field            - "metaTitle" | "metaDescription" | "description"
//   label            - Etiqueta legible del campo
//   currentValue     - Valor actual del campo (string)
//   productId        - ID numérico del producto (para el POST a api.generate-text)
//   plan             - tier del merchant ("free"|"pro"|"pro_plus")
//   aiMetaRemaining  - Cuántas generaciones AI quedan este mes
//   upgradeUrl       - URL de la página de planes
//   onApply          - Callback que recibe { field, value } al hacer Apply
//   isApplying       - boolean: hay un submit de applyText en curso

import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";

export default function AiTextField({
  field,
  label,
  currentValue,
  productId,
  plan,
  aiMetaRemaining,
  upgradeUrl,
  onApply,
  isApplying,
}) {
  const fetcher = useFetcher();
  const [previewText, setPreviewText] = useState("");
  const [hasPreview, setHasPreview] = useState(false);

  const isGenerating = fetcher.state !== "idle";

  // Cuando el fetcher recibe respuesta, actualizar el preview.
  const prevDataRef = useRef(null);
  useEffect(() => {
    if (!fetcher.data || fetcher.data === prevDataRef.current) return;
    prevDataRef.current = fetcher.data;
    if (fetcher.data.ok) {
      setPreviewText(fetcher.data.text);
      setHasPreview(true);
    }
  }, [fetcher.data]);

  const handleGenerate = () => {
    if (isGenerating || aiMetaRemaining <= 0) return;
    fetcher.submit(
      { productId: String(productId), field },
      { method: "post", action: "/api/generate-text" },
    );
  };

  const handleApply = () => {
    if (!hasPreview || isApplying) return;
    onApply({ field, value: previewText });
  };

  // Estado del fetcher: error en el payload o error de red.
  const generateError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  // -----------------------------------------------------------------------
  // Free plan: sin botón Generate, solo upgrade CTA
  // -----------------------------------------------------------------------
  if (plan === "free") {
    return (
      <s-stack direction="block" gap="small-300">
        <s-text tone="subdued">{label}</s-text>
        {currentValue ? (
          <s-text>{currentValue}</s-text>
        ) : (
          <s-text tone="critical">Empty</s-text>
        )}
        <s-stack direction="block" gap="small-300">
          <s-text tone="subdued">AI text is a Pro feature.</s-text>
          <s-button href={upgradeUrl} target="_top">
            Upgrade to Pro
          </s-button>
        </s-stack>
      </s-stack>
    );
  }

  // -----------------------------------------------------------------------
  // Plan pago: Generate → editable preview → Apply
  // -----------------------------------------------------------------------
  const quotaExhausted = aiMetaRemaining <= 0;

  return (
    <s-stack direction="block" gap="small-300">
      <s-text tone="subdued">{label}</s-text>
      {currentValue ? (
        <s-text>{currentValue}</s-text>
      ) : (
        <s-text tone="critical">Empty</s-text>
      )}

      {generateError && (
        <s-banner tone="critical" heading="Generation error">
          <s-paragraph>{generateError}</s-paragraph>
        </s-banner>
      )}

      {isGenerating ? (
        <s-spinner size="small" />
      ) : (
        <s-button
          {...(quotaExhausted ? { disabled: true } : {})}
          onClick={handleGenerate}
        >
          Generate with AI
        </s-button>
      )}

      {quotaExhausted && !isGenerating && (
        <s-text tone="subdued">0 AI generations left this month.</s-text>
      )}

      {hasPreview && (
        <s-stack direction="block" gap="small-300">
          <s-text-area
            label={`Preview: ${label}`}
            value={previewText}
            onInput={(e) => setPreviewText(e.target.value)}
          />
          <s-button
            variant="primary"
            {...(isApplying ? { loading: true } : {})}
            onClick={handleApply}
          >
            Apply
          </s-button>
        </s-stack>
      )}
    </s-stack>
  );
}
