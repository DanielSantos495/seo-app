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

  let text;
  try {
    if (field === "metaTitle") {
      text = await generateMetaTitle({ context, locale });
    } else if (field === "metaDescription") {
      text = await generateMetaDescription({ context, locale });
    } else {
      text = await generateDescription({ context, locale });
    }
  } catch {
    // Falló la generación (LLM caído/inválido): no se cobra quota.
    return Response.json({
      ok: false,
      error: "Generation failed. Please try again.",
    });
  }

  // Cobrar la quota best-effort: una generación exitosa nunca se reporta como
  // fallo por un error transitorio al persistir el uso (dirección segura:
  // undercharge, nunca cobrar de más ni descartar texto ya generado).
  try {
    await increment(session.shop, "aiMeta", 1);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[generate-text] usage increment failed:", e?.message || e);
  }

  return Response.json({ ok: true, field, text });
};
