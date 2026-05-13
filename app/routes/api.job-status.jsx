import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { findActiveJob, findJobById, serializeJob } from "../services/seo-job";

// Resource route que el cliente consulta cada ~2 s para enterarse del
// progreso de un job. Soporta dos modos:
//   - ?id=<jobId>  → estado de un job específico (lo usa el bulk fix tras
//     submit del action que devuelve el jobId).
//   - ?type=analysis|bulk_alt → último job del shop para ese tipo. Si hay
//     uno activo lo devuelve; si no, devuelve el más reciente (cualquier
//     status) para que el cliente detecte la transición done/failed —
//     antes, si el job acababa entre polls (caso 200 productos en ~2 s),
//     el cliente quedaba con el initialJob viejo y "Analizando…" eterno.
//
// Devuelve `{ job: null }` solo si nunca hubo un job de ese tipo.
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
    let job = await findActiveJob(session.shop, type);
    if (!job) {
      job = await prisma.seoJob.findFirst({
        where: { shop: session.shop, type },
        orderBy: { createdAt: "desc" },
      });
    }
    return { job: serializeJob(job) };
  }

  return { job: null };
};
