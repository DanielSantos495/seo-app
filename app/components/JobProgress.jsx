/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";

// Hook que hace polling al endpoint /api/job-status cada `intervalMs` mientras
// el job esté pending/running. Cuando termina (done/failed), dispara
// `onFinish(finalJob)` y deja de pollear.
//
// Acepta `initialJob` (el que vino del loader) para mostrar progreso
// inmediato sin esperar al primer poll.
//
// Modo:
//   - `byId`: si se pasa, consulta el job específico.
//   - `byType`: si se pasa (sin id), consulta el último job activo del tipo.
export function useJobPolling({
  initialJob,
  byId,
  byType,
  intervalMs = 2000,
  onFinish,
}) {
  const fetcher = useFetcher();
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Una vez que el fetcher recibió respuesta, su valor manda — aunque sea
  // null. Antes usábamos `fetcher.data?.job || initialJob`, lo que dejaba
  // al cliente colgado con initialJob viejo si el job terminaba muy rápido
  // y el polling devolvía null (porque findActiveJob descarta done/failed).
  const job = fetcher.data
    ? fetcher.data.job
    : initialJob || null;
  const isActive = !!(job && (job.status === "pending" || job.status === "running"));

  const url = byId
    ? `/api/job-status?id=${encodeURIComponent(byId)}`
    : byType
      ? `/api/job-status?type=${encodeURIComponent(byType)}`
      : null;

  useEffect(() => {
    if (!url) return;
    if (!isActive && !byType) return; // si no hay job activo y no estamos buscando uno por tipo, no pollear

    const tick = () => {
      if (fetcher.state === "idle") fetcher.load(url);
    };
    // Primer tick inmediato si no tenemos data aún.
    if (!fetcher.data) tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isActive, byType]);

  // Detectar transición active → no-active. Llamamos onFinish siempre que
  // ocurra la transición, aunque `job` sea null (job desapareció / fue
  // limpiado). Los callers deben tolerar `finalJob` null.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      onFinishRef.current?.(job);
    }
    wasActiveRef.current = isActive;
  }, [isActive, job]);

  return { job, isActive };
}

// Vista visual estándar del progreso de un job. Muestra barra (si conocemos
// total) o spinner indeterminado (si no), texto X / Y, y ETA.
export function JobProgress({ job, label = "Processing" }) {
  if (!job) return null;
  const { processed, total, status } = job;
  const pct =
    total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;

  if (status === "failed") {
    return (
      <s-banner tone="critical" heading="The process failed">
        <s-paragraph>
          {job.errorMessage || "An unexpected error occurred. Try again."}
        </s-paragraph>
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="small-300">
      <s-stack direction="inline" gap="small-300" alignment="center">
        <s-spinner />
        <s-text>
          {label}
          {total > 0 ? ` · ${processed} / ${total}` : ` · ${processed} processed`}
          {pct !== null ? ` (${pct}%)` : ""}
        </s-text>
      </s-stack>
    </s-stack>
  );
}

// Helper para revalidar la ruta actual cuando un job termina (refresca data
// del loader sin reload completo).
export function useRevalidateOnFinish() {
  const revalidator = useRevalidator();
  return () => revalidator.revalidate();
}
