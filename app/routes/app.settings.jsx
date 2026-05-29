import { useEffect, useRef, useState } from "react";
import { useActionData, useLoaderData, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../services/shop-settings";

const MAX_BRAND_CONTEXT = 2000;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { brandContext } = await getSettings(session.shop);
  return { brandContext };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const brandContext = String(formData.get("brandContext") ?? "").slice(
    0,
    MAX_BRAND_CONTEXT,
  );
  await saveSettings(session.shop, { brandContext });
  return { ok: true };
};

export default function Settings() {
  const { brandContext: initial } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [brandContext, setBrandContext] = useState(initial ?? "");

  // Disparar toast UNA vez por submit exitoso (ref-guard igual que product detail).
  const shownToastRef = useRef(null);
  useEffect(() => {
    if (!actionData || shownToastRef.current === actionData) return;
    shownToastRef.current = actionData;
    if (actionData.ok) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  function handleSave() {
    const fd = new FormData();
    fd.append("brandContext", brandContext);
    submit(fd, { method: "post" });
  }

  return (
    <s-page heading="Settings">
      <s-section heading="Brand &amp; store context">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            This context is sent to the AI to improve generation quality. It is
            used by: AI alt text, meta titles, meta descriptions, and product
            descriptions.
          </s-paragraph>

          <s-text-area
            label="Brand context"
            value={brandContext}
            onInput={(e) => setBrandContext(e.target.value)}
            placeholder="e.g. Specialty coffee brand. Warm, expert tone, no jargon. Audience: home-baristas 25–45. Differentiator: small-batch artisan roasting, direct trade. English (US). Avoid health claims."
            maxLength={MAX_BRAND_CONTEXT}
          />

          <s-stack direction="block" gap="small-300">
            <s-text tone="subdued">
              What to include: brand voice &amp; tone, industry, target
              audience, key differentiators, preferred language, and anything to
              avoid.
            </s-text>
            <s-text tone="subdued">
              Example: &ldquo;Specialty coffee brand. Warm, expert tone, no
              jargon. Audience: home-baristas 25&ndash;45. Differentiator:
              small-batch artisan roasting, direct trade. English (US). Avoid
              health claims.&rdquo;
            </s-text>
          </s-stack>

          <s-button variant="primary" onClick={handleSave}>
            Save
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
