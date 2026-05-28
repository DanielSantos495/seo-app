// Cliente genérico para la Anthropic Messages API.
// Sin SDK — solo fetch nativo para mantener dependencias mínimas.
//
// Uso:
//   import { callAnthropicMessages } from "./anthropic-fetch";
//   const response = await callAnthropicMessages({ system, messages, maxTokens: 100 });
//
// El caller recibe el JSON completo de Anthropic (con .content, .usage, etc.).
// Si la API key falta, si se agota el retry o si hay un 4xx no recuperable → throw.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Reintentos: hasta 3 intentos en total (2 reintentos tras el primero).
const MAX_ATTEMPTS = 3;

// Delay base en ms para el backoff exponencial.
// Exportado para que los tests puedan reemplazarlo con una función instantánea.
export let _delayFn = (ms) => new Promise((r) => setTimeout(r, ms));

// Permite que los tests inyecten un delay nulo para correr rápido.
export function _setDelayFn(fn) {
  _delayFn = fn;
}

function baseDelay(attempt) {
  // 100ms * 2^attempt (0→100, 1→200, 2→400). Pequeño para no trabar tests.
  return 100 * 2 ** attempt;
}

/**
 * Llama a la Anthropic Messages API con reintentos en 429/5xx.
 *
 * @param {object} opts
 * @param {string} [opts.system]       - Prompt de sistema.
 * @param {Array}  opts.messages       - Array de mensajes Anthropic.
 * @param {number} [opts.maxTokens=256]- Tokens máximos de respuesta.
 * @returns {Promise<object>}          - JSON completo de la respuesta Anthropic.
 */
export async function callAnthropicMessages({ system, messages, maxTokens = 256 }) {
  // eslint-disable-next-line no-undef
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — cannot call Anthropic API");
  }

  // eslint-disable-next-line no-undef
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const body = { model, max_tokens: maxTokens, messages };
  if (system) body.system = system;

  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }

      const status = response.status;

      // 4xx no recuperables (excepto 429) → falla inmediata sin retry.
      if (status >= 400 && status < 500 && status !== 429) {
        let detail = "";
        try {
          const errJson = await response.json();
          detail = errJson?.error?.message || JSON.stringify(errJson);
        } catch {
          detail = response.statusText;
        }
        throw new Error(`Anthropic API error ${status}: ${detail}`);
      }

      // 429 o 5xx → reintenta con backoff.
      lastError = new Error(`Anthropic API error ${status}`);
      if (attempt < MAX_ATTEMPTS - 1) {
        await _delayFn(baseDelay(attempt));
      }
    } catch (err) {
      clearTimeout(timeout);
      // Si es el error no-recuperable que lanzamos arriba, propagarlo de inmediato.
      if (err.message?.startsWith("Anthropic API error 4")) {
        throw err;
      }
      lastError = err;
      if (attempt < MAX_ATTEMPTS - 1) {
        await _delayFn(baseDelay(attempt));
      }
    }
  }

  throw lastError || new Error("callAnthropicMessages failed after retries");
}
