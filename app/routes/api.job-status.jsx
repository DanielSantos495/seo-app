import { authenticate } from "../shopify.server";
import { findActiveJob, findJobById, serializeJob } from "../services/seo-job";

// Resource route que el cliente consulta cada ~2 s para enterarse del
// progreso de un job. Soporta dos modos:
//   - ?id=<jobId>  → estado de un job específico (lo usa el bulk fix tras
//     submit del action que devuelve el jobId).
//   - ?type=analysis|bulk_alt → último job activo del shop para ese tipo
//     (lo usa el dashboard para detectar análisis en curso).
//
// Devuelve `null` si no hay job que reportar.
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type");

  if (id) {
    const job = await findJobById(id);
    // Defensa: no exponer jobs de otro shop.
    if (!job || job.shop !== session.shop) return { job: null };
    return { job: serializeJob(job) };
  }

  if (type) {
    const job = await findActiveJob(session.shop, type);
    return { job: serializeJob(job) };
  }

  return { job: null };
};
