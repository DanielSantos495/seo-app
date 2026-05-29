// Ruta de recurso: genera texto SEO con IA para un campo específico de un producto.
// POST con { productId, field: "metaTitle"|"metaDescription"|"description" }.
// Gate: quota aiMeta por plan (free = 0, pro/pro+ = N/mes).
// No default export (resource route — sin UI propia).

import { authenticate } from "../shopify.server";
import { getPlanInfo } from "../services/plan";
import { remaining, increment } from "../services/ai-usage";
import { fetchProductById, getShopContext } from "../services/shopify-api";
import { getSettings } from "../services/shop-settings";
import { buildContext } from "../services/ai-context";
import {
  generateMetaTitle,
  generateMetaDescription,
  generateDescription,
} from "../services/text-gen-ai";

export const action = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const formData = await request.formData();
  const productId = formData.get("productId");
  const field = formData.get("field");

  // Validar campo antes de consumir créditos.
  const validFields = ["metaTitle", "metaDescription", "description"];
  if (!field || !validFields.includes(field)) {
    return Response.json({ ok: false, error: "Unknown field." });
  }

  // Resolver plan y quota.
  const { tier } = await getPlanInfo(billing);
  const rem = await remaining(session.shop, tier, "aiMeta");
  if (rem <= 0) {
    return Response.json({
      ok: false,
      error:
        tier === "free"
          ? "AI text generation is a Pro feature."
          : "You've reached this month's AI limit.",
    });
  }

  // Fetch del producto.
  const gid = `gid://shopify/Product/${productId}`;
  const product = await fetchProductById(admin, gid);
  if (!product) {
    return Response.json({ ok: false, error: "Product not found." });
  }

  // Construir contexto del merchant.
  const [shop, { brandContext }] = await Promise.all([
    getShopContext(admin),
    getSettings(session.shop),
  ]);
  const context = buildContext({ shop, product, merchantContext: brandContext });

  const locale = session.locale ?? null;

  try {
    let text;
    if (field === "metaTitle") {
      text = await generateMetaTitle({ context, locale });
    } else if (field === "metaDescription") {
      text = await generateMetaDescription({ context, locale });
    } else {
      text = await generateDescription({ context, locale });
    }

    // Incrementar solo en éxito.
    await increment(session.shop, "aiMeta", 1);

    return Response.json({ ok: true, field, text });
  } catch {
    return Response.json({
      ok: false,
      error: "Generation failed. Please try again.",
    });
  }
};
