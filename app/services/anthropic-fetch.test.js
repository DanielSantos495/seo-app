import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  callAnthropicMessages,
  DEFAULT_MODEL,
  _setDelayFn,
} from "./anthropic-fetch.js";

// Delay nulo para que los tests corran instantáneo.
_setDelayFn(() => Promise.resolve());

const FAKE_KEY = "sk-ant-test-fake-key-123";

// Fábrica de Response mínima compatible con fetch.
function makeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  // eslint-disable-next-line no-undef
  process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  // eslint-disable-next-line no-undef
  delete process.env.ANTHROPIC_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // eslint-disable-next-line no-undef
  delete process.env.ANTHROPIC_API_KEY;
  // eslint-disable-next-line no-undef
  delete process.env.ANTHROPIC_MODEL;
});

// ---------------------------------------------------------------------------
// Caso éxito (200)
// ---------------------------------------------------------------------------
describe("callAnthropicMessages — éxito 200", () => {
  it("llama a la URL correcta y devuelve el JSON parseado", async () => {
    const fakeResponse = {
      id: "msg_01",
      content: [{ type: "text", text: "Blue denim jacket" }],
      model: DEFAULT_MODEL,
    };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, fakeResponse));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropicMessages({
      system: "You are a helper.",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result).toEqual(fakeResponse);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-api-key"]).toBe(FAKE_KEY);
    expect(opts.headers["anthropic-version"]).toBe("2023-06-01");
    expect(opts.headers["content-type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(body.system).toBe("You are a helper.");
    expect(body.max_tokens).toBe(256);
  });

  it("usa ANTHROPIC_MODEL del entorno si está definido", async () => {
    // eslint-disable-next-line no-undef
    process.env.ANTHROPIC_MODEL = "claude-opus-custom";
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { content: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await callAnthropicMessages({ messages: [{ role: "user", content: "Hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("claude-opus-custom");
  });
});

// ---------------------------------------------------------------------------
// API key ausente → lanza sin llamar fetch
// ---------------------------------------------------------------------------
describe("callAnthropicMessages — API key ausente", () => {
  it("lanza Error sin llamar fetch cuando ANTHROPIC_API_KEY está vacío", async () => {
    // eslint-disable-next-line no-undef
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callAnthropicMessages({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 429 luego 200 → reintenta y tiene éxito
// ---------------------------------------------------------------------------
describe("callAnthropicMessages — retry en 429", () => {
  it("reintenta tras un 429 y devuelve el resultado del segundo intento", async () => {
    const successBody = { content: [{ type: "text", text: "ok" }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, {}))
      .mockResolvedValueOnce(makeResponse(200, successBody));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropicMessages({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result).toEqual(successBody);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 500 persistente → lanza después de agotar reintentos
// ---------------------------------------------------------------------------
describe("callAnthropicMessages — 500 persistente", () => {
  it("lanza tras MAX_ATTEMPTS intentos fallidos en 500", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callAnthropicMessages({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(/Anthropic API error 500/);

    // 3 intentos en total (MAX_ATTEMPTS = 3)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// 400 → falla inmediata, sin retry
// ---------------------------------------------------------------------------
describe("callAnthropicMessages — 400 no recuperable", () => {
  it("lanza inmediatamente en 400 sin reintentar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(400, { error: { message: "bad request" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callAnthropicMessages({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(/400/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
