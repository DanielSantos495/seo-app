// Lógica de planes (Managed App Pricing). Server-only.
// Fuente de verdad del plan: Shopify (billing.check). Este módulo solo
// traduce tier → qué puede hacer el merchant (mapa de entitlements).

// Nombres de tier internos. Free = ausencia de suscripción.
export const PLAN = {
  FREE: "free",
  PRO: "pro",
  PRO_PLUS: "pro_plus",
};

// Etiqueta legible del tier para mostrar en la UI.
export const PLAN_LABEL = {
  [PLAN.FREE]: "Free",
  [PLAN.PRO]: "Pro",
  [PLAN.PRO_PLUS]: "Pro+",
};

// Mapea el NOMBRE de la suscripción de Shopify (tal cual está en el Partner
// Dashboard, Managed Pricing) → tier interno. Las claves van en minúscula
// para tolerar diferencias de capitalización.
const SUBSCRIPTION_NAME_TO_TIER = {
  pro: PLAN.PRO,
  "pro+": PLAN.PRO_PLUS,
  // $0 private test plan (dev): billing.check devuelve el display name "Pro Test".
  // Solo existe como plan privado; ningún merchant real lo tiene.
  "pro test": PLAN.PRO,
};

// Mapa declarativo tier → capabilities (boolean) y quotas (number).
// Agregar una feature o un tier = editar solo este objeto.
export const ENTITLEMENTS = {
  [PLAN.FREE]: {
    pagesAnalysis: false,
    htmlAnalysis: false,
    inlineAltEdit: false,
    recurringAudits: false,
    aiAlt: 0,
    aiMeta: 0,
  },
  [PLAN.PRO]: {
    pagesAnalysis: true,
    htmlAnalysis: true,
    inlineAltEdit: true,
    recurringAudits: false,
    aiAlt: 100,
    aiMeta: 50,
  },
  [PLAN.PRO_PLUS]: {
    pagesAnalysis: true,
    htmlAnalysis: true,
    inlineAltEdit: true,
    recurringAudits: true,
    aiAlt: 500,
    aiMeta: 300,
  },
};

// Pura: nombre de suscripción → tier. Vacío/desconocido → FREE.
export function planFromSubscriptionName(name) {
  if (!name) return PLAN.FREE;
  const tier = SUBSCRIPTION_NAME_TO_TIER[name.trim().toLowerCase()];
  if (!tier) {
    // eslint-disable-next-line no-console
    console.warn(`[plan] Unknown subscription name "${name}" → treating as free`);
    return PLAN.FREE;
  }
  return tier;
}

// Pura: ¿este tier tiene esta capability boolean?
export function can(plan, capability) {
  return ENTITLEMENTS[plan]?.[capability] === true;
}

// Pura: quota numérica del tier para esta key. 0 = sin acceso. Desconocido → 0.
export function quota(plan, key) {
  const value = ENTITLEMENTS[plan]?.[key];
  return typeof value === "number" ? value : 0;
}

// isTest se deriva de env: BILLING_TEST distinto de "false" → test.
// IMPORTANTE: el default (var ausente) es test=true, por seguridad en dev.
// PROD DEBE setear BILLING_TEST="false" en Railway; si no, billing.check con
// isTest=true ignora las suscripciones reales y todos verían "free".
function isTestBilling() {
  // eslint-disable-next-line no-undef
  return process.env.BILLING_TEST !== "false";
}

// Lee la suscripción activa vía billing.check y devuelve el nombre crudo del
// plan + el tier resuelto. NUNCA lanza: cualquier error → FREE sin nombre
// (fail-closed). `name` es null si no hay suscripción activa.
export async function getPlanInfo(billing) {
  try {
    const { appSubscriptions } = await billing.check({ isTest: isTestBilling() });
    const name = appSubscriptions?.[0]?.name ?? null;
    return { name, tier: planFromSubscriptionName(name) };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[plan] billing.check failed → treating as free:",
      error?.message || error,
    );
    return { name: null, tier: PLAN.FREE };
  }
}

// Conveniencia para gating: solo el tier. Delega en getPlanInfo (DRY).
export async function getPlan(billing) {
  return (await getPlanInfo(billing)).tier;
}

// URL de la página de planes hosteada por Shopify (Managed Pricing).
// shopHandle = subdominio de la store (ej. "artesamir").
// APP_HANDLE es específico del entorno (dev/prod) → viene de env.
export function pricingPageUrl(shopHandle) {
  // eslint-disable-next-line no-undef
  const appHandle = process.env.APP_HANDLE || "";
  return `https://admin.shopify.com/store/${shopHandle}/charges/${appHandle}/pricing_plans`;
}
