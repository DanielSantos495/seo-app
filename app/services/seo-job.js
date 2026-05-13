import prisma from "../db.server";

// Helpers para manejar jobs en background. Centraliza la persistencia y la
// detección de jobs zombies (proceso reinició a mitad del job).
//
// Tipos de job:
//   - "analysis": análisis SEO full del catálogo
//   - "bulk_alt": bulk fix de alt texts
//
// Status:
//   - pending  → creado, aún no arrancó
//   - running  → en ejecución, hace heartbeat cada batch
//   - done     → terminó OK
//   - failed   → error o zombie detectado

// Considera muerto un job sin heartbeat hace más de este tiempo. El siguiente
// loader que lo detecte lo marca `failed` y deja al usuario re-arrancarlo.
const ZOMBIE_THRESHOLD_MS = 5 * 60 * 1000;

export async function createJob(shop, type, { total = 0, payload = null } = {}) {
  return prisma.seoJob.create({
    data: {
      shop,
      type,
      status: "pending",
      total,
      payload: payload ? JSON.stringify(payload) : null,
    },
  });
}

export async function startJob(jobId) {
  return prisma.seoJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  });
}

// Actualiza progreso + heartbeat. Llamar cada N items procesados (típicamente
// cada batch). Si el proceso muere entre heartbeats, ZOMBIE_THRESHOLD_MS marca
// el job como failed.
export async function bumpProgress(jobId, { processed, total } = {}) {
  const data = { lastHeartbeatAt: new Date() };
  if (typeof processed === "number") data.processed = processed;
  if (typeof total === "number") data.total = total;
  return prisma.seoJob.update({ where: { id: jobId }, data });
}

export async function finishJob(jobId, { resultSummary = null } = {}) {
  return prisma.seoJob.update({
    where: { id: jobId },
    data: {
      status: "done",
      finishedAt: new Date(),
      resultSummary: resultSummary ? JSON.stringify(resultSummary) : null,
    },
  });
}

export async function failJob(jobId, errorMessage) {
  return prisma.seoJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: errorMessage?.slice?.(0, 1000) || "unknown error",
    },
  });
}

// Devuelve el job activo (pending o running) más reciente del shop para un tipo.
// Antes de devolverlo, sanea jobs zombies (sin heartbeat reciente).
export async function findActiveJob(shop, type) {
  const job = await prisma.seoJob.findFirst({
    where: { shop, type, status: { in: ["pending", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;

  const heartbeat = job.lastHeartbeatAt || job.startedAt || job.createdAt;
  if (Date.now() - heartbeat.getTime() > ZOMBIE_THRESHOLD_MS) {
    await failJob(job.id, "Job sin heartbeat — proceso interrumpido");
    return null;
  }
  return job;
}

// Lectura tipada para el cliente: parsea payload/resultSummary y serializa
// fechas a ISO. Útil para el endpoint api.job-status.
export function serializeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    processed: job.processed,
    total: job.total,
    payload: job.payload ? JSON.parse(job.payload) : null,
    resultSummary: job.resultSummary ? JSON.parse(job.resultSummary) : null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt?.toISOString?.() || null,
    startedAt: job.startedAt?.toISOString?.() || null,
    finishedAt: job.finishedAt?.toISOString?.() || null,
  };
}

export async function findJobById(jobId) {
  return prisma.seoJob.findUnique({ where: { id: jobId } });
}

// Devuelve el último job failed reciente para mostrar un banner accionable.
// "Reciente" = última hora. Si el merchant ya volvió a disparar uno y completó,
// no queremos seguir mostrando el error viejo.
const RECENT_WINDOW_MS = 60 * 60 * 1000;

export async function findRecentFailedJob(shop, type) {
  const job = await prisma.seoJob.findFirst({
    where: {
      shop,
      type,
      status: "failed",
      finishedAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) },
    },
    orderBy: { finishedAt: "desc" },
  });
  if (!job) return null;

  // Si después hubo uno OK, descartamos el failed (ya se recuperó).
  const newerDone = await prisma.seoJob.findFirst({
    where: {
      shop,
      type,
      status: "done",
      finishedAt: { gt: job.finishedAt },
    },
    select: { id: true },
  });
  if (newerDone) return null;
  return job;
}
