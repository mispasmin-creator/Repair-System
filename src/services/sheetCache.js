/**
 * sheetCache.js
 * Cached GET for Apps Script sheet reads. Returns a real Response so existing
 * call sites (res.ok, res.json(), res.text()) keep working unchanged.
 *
 * - In-memory copy for a few seconds (page-to-page navigation)
 * - localStorage snapshot for a couple of minutes (reloads show data instantly)
 * - Timeout + fallback to last known data when Apps Script is slow or fails
 * - Any POST to the app's script (a write) clears every cached read, because
 *   a write can change any sheet.
 */
import { invalidateRepairTasksCache } from "./repairService";
import { invalidateAdvancePaymentsCache } from "./advancePaymentService";

const MEMORY_TTL_MS = 15000;
const SNAPSHOT_FRESH_MS = 120000;
const FETCH_TIMEOUT_MS = 25000;
const STORAGE_PREFIX = "sheetCache:";

const memory = new Map();
const inFlight = new Map();

const readSnapshot = (url) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + url);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// The login sheet holds passwords — keep it in memory only, never in localStorage
const isSensitive = (url) => /Repair(%20| )Login/i.test(url);

const writeSnapshot = (url, text) => {
  if (isSensitive(url)) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + url, JSON.stringify({ text, ts: Date.now() }));
  } catch {
    // quota exceeded or storage disabled — memory cache still applies
  }
};

const clearSnapshots = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable
  }
};

const asResponse = (text) => new Response(text, {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

// Timeout only when a saved copy exists to fall back on; otherwise wait for the data
const fetchText = async (url, withTimeout) => {
  const controller = new AbortController();
  const timer = withTimeout ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const res = await originalFetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Apps Script sometimes returns a Google HTML error page instead of JSON
    if (text.trim().startsWith("<")) throw new Error("Server returned HTML");
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const originalFetch = window.fetch.bind(window);

export const cachedFetch = async (url) => {
  const mem = memory.get(url);
  if (mem && Date.now() - mem.ts < MEMORY_TTL_MS) return asResponse(mem.text);

  const snap = isSensitive(url) ? null : readSnapshot(url);
  if (snap?.text && Date.now() - snap.ts < SNAPSHOT_FRESH_MS) {
    memory.set(url, { text: snap.text, ts: snap.ts });
    return asResponse(snap.text);
  }

  if (!inFlight.has(url)) {
    const hasFallback = !isSensitive(url) && Boolean(readSnapshot(url)?.text);
    const request = fetchText(url, hasFallback)
      .then((text) => {
        memory.set(url, { text, ts: Date.now() });
        writeSnapshot(url, text);
        return text;
      })
      .catch((err) => {
        // Slow or failed Apps Script: show last known data instead of an empty screen
        const fallback = isSensitive(url) ? null : readSnapshot(url);
        if (fallback?.text) return fallback.text;
        throw err;
      })
      .finally(() => inFlight.delete(url));
    inFlight.set(url, request);
  }
  return asResponse(await inFlight.get(url));
};

const invalidateAllReads = () => {
  memory.clear();
  clearSnapshots();
  invalidateRepairTasksCache();
  invalidateAdvancePaymentsCache();
};

// Wrap window.fetch once so every write (POST) made anywhere in the app invalidates reads.
if (!window.__sheetCacheWriteHook) {
  window.__sheetCacheWriteHook = true;
  window.fetch = (input, init) => {
    const isWrite = (init?.method || "GET").toUpperCase() !== "GET";
    const request = originalFetch(input, init);
    if (isWrite) request.finally(invalidateAllReads);
    return request;
  };
}
