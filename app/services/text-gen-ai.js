// Generación de textos SEO con Claude (Anthropic Messages API).
// Produce meta title, meta description y descripción de producto en texto plano.
// Lanza excepción en cualquier fallo (API key ausente, red, respuesta vacía).
//
// Uso:
//   import { generateMetaTitle, generateMetaDescription, generateDescription } from "./text-gen-ai";
//   const title = await generateMetaTitle({ context, locale });

import { callAnthropicMessages } from "./anthropic-fetch.js";

// Límites duros de longitud por tipo de campo.
const CAP_TITLE = 60;
const CAP_META_DESCRIPTION = 160;
const CAP_DESCRIPTION = 1500;

const SYSTEM_PROMPT =
  "You are an SEO copywriter for e-commerce product pages. " +
  "Write concise, compelling copy. No keyword stuffing. " +
  "Never wrap output in quotes. Output ONLY the requested text, nothing else.";

/**
 * Trunca `text` a `cap` caracteres. Añade "…" si se recorta.
 * @param {string} text
 * @param {number} cap
 * @returns {string}
 */
function truncateTo(text, cap) {
  if (!text || text.length <= cap) return text;
  return `${text.slice(0, cap - 1)}…`;
}

/**
 * Helper privado compartido por los tres generadores.
 * Construye el mensaje user, llama a Anthropic, extrae y valida el texto.
 *
 * @param {object} opts
 * @param {string} opts.task      - Instrucción de tarea (lo que el modelo debe escribir).
 * @param {string} opts.context   - Bloque de contexto pre-construido por buildContext().
 * @param {string} [opts.locale]  - Locale BCP-47. Omitir para inglés.
 * @param {number} opts.maxTokens - Tokens máximos de respuesta.
 * @param {number|null} [opts.cap]- Truncar resultado a este número de chars (null = sin tope).
 * @param {string} opts.callerName - Nombre de la función para mensajes de error.
 * @returns {Promise<string>}
 */
async function callAndExtract({ task, context, locale, maxTokens, cap, callerName }) {
  const localeInstruction = locale
    ? ` Respond in the language of locale "${locale}".`
    : "";

  const userContent =
    `${context}\n\nTask: ${task}${localeInstruction} Output ONLY the result, no quotes or preamble.`;

  const messages = [{ role: "user", content: userContent }];

  const response = await callAnthropicMessages({
    system: SYSTEM_PROMPT,
    messages,
    maxTokens,
  });

  const rawText = response?.content?.[0]?.text;
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    throw new Error(`${callerName}: Anthropic response had no usable text`);
  }

  // Trim y quitar comillas envolventes si el modelo las incluyó.
  let text = rawText.trim();
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
    text = text.slice(1, -1).trim();
  } else if (text.startsWith("'") && text.endsWith("'") && text.length > 1) {
    text = text.slice(1, -1).trim();
  }

  if (!text) {
    throw new Error(`${callerName}: Anthropic response had no usable text after strip`);
  }

  return cap != null ? truncateTo(text, cap) : text;
}

/**
 * Genera un meta title SEO optimizado (objetivo 50–60 chars, hard-cap 60).
 *
 * @param {object} opts
 * @param {string} opts.context  - Bloque de contexto pre-construido por buildContext().
 * @param {string} [opts.locale] - Locale BCP-47. Omitir para inglés.
 * @returns {Promise<string>}    - Meta title ≤60 chars.
 */
export async function generateMetaTitle({ context, locale }) {
  return callAndExtract({
    task: "Write an SEO meta title for this product. Target 50–60 characters.",
    context,
    locale,
    maxTokens: 80,
    cap: CAP_TITLE,
    callerName: "generateMetaTitle",
  });
}

/**
 * Genera una meta description SEO optimizada (objetivo 120–160 chars, hard-cap 160).
 *
 * @param {object} opts
 * @param {string} opts.context  - Bloque de contexto pre-construido por buildContext().
 * @param {string} [opts.locale] - Locale BCP-47. Omitir para inglés.
 * @returns {Promise<string>}    - Meta description ≤160 chars.
 */
export async function generateMetaDescription({ context, locale }) {
  return callAndExtract({
    task: "Write an SEO meta description for this product. Target 120–160 characters.",
    context,
    locale,
    maxTokens: 200,
    cap: CAP_META_DESCRIPTION,
    callerName: "generateMetaDescription",
  });
}

/**
 * Genera una descripción de producto en texto plano (1–3 párrafos cortos,
 * separados por \n\n, al menos ~100 chars, hard-cap 1500).
 * Phase C convierte los párrafos en HTML <p> al aplicar.
 *
 * @param {object} opts
 * @param {string} opts.context  - Bloque de contexto pre-construido por buildContext().
 * @param {string} [opts.locale] - Locale BCP-47. Omitir para inglés.
 * @returns {Promise<string>}    - Descripción en texto plano con párrafos separados por \n\n.
 */
export async function generateDescription({ context, locale }) {
  return callAndExtract({
    task:
      "Write a product description in plain text. Use 1–3 short paragraphs separated by a blank line (\\n\\n). No HTML. At least 100 characters total.",
    context,
    locale,
    maxTokens: 600,
    cap: CAP_DESCRIPTION,
    callerName: "generateDescription",
  });
}
