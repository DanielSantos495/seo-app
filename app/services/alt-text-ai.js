// Generador de alt texts con Claude Vision (Anthropic Messages API).
//
// Recibe una URL de imagen + título del producto y devuelve un string con el alt.
// Lanza excepción en cualquier fallo (API key ausente, red, respuesta vacía).
// El caller (Phase C) atrapa y hace fallback al generador determinístico.
//
// Uso:
//   import { generateAltTextWithAI } from "./alt-text-ai";
//   const alt = await generateAltTextWithAI({ imageUrl, productTitle, locale });

import { callAnthropicMessages } from "./anthropic-fetch.js";
import { truncate, MAX_LENGTH } from "./alt-text-generator.js";

const SYSTEM_PROMPT =
  "You are an accessibility assistant that writes concise, descriptive alt text for " +
  "e-commerce product images. Rules: maximum " +
  MAX_LENGTH +
  " characters, describe only what is visible in the image, do NOT start with " +
  '"image of", "photo of", or any similar preamble, output ONLY the alt text with ' +
  "no surrounding quotes, no explanations, no extra text.";

/**
 * Genera alt text para una imagen de producto usando Claude Vision.
 *
 * @param {object} opts
 * @param {string} opts.imageUrl      - URL pública de la imagen.
 * @param {string} opts.productTitle  - Título del producto.
 * @param {string} [opts.locale]      - Locale BCP-47 (ej. "es", "fr"). Omitir para inglés.
 * @returns {Promise<string>}         - Alt text ≤125 chars, ya truncado.
 * @throws {Error}                    - En cualquier fallo.
 */
export async function generateAltTextWithAI({ imageUrl, productTitle, locale }) {
  const userText =
    `Product: ${productTitle}. Write the alt text` +
    (locale ? ` in the language of locale "${locale}".` : ".");

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "url", url: imageUrl },
        },
        {
          type: "text",
          text: userText,
        },
      ],
    },
  ];

  const response = await callAnthropicMessages({
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 100,
  });

  const rawText = response?.content?.[0]?.text;
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("generateAltTextWithAI: Anthropic response had no usable text");
  }

  // Trim y quitar comillas envolventes si el modelo las incluyó ("Blue shirt" → Blue shirt).
  let text = rawText.trim();
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
    text = text.slice(1, -1).trim();
  } else if (text.startsWith("'") && text.endsWith("'") && text.length > 1) {
    text = text.slice(1, -1).trim();
  }

  return truncate(text);
}
