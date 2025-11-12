const DEFAULT_ERROR_MESSAGE = "Request failed";

export async function readJsonSafe<T = unknown>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

export function getErrorMessage(
  response: Response | undefined,
  payload: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string {
  const fromPayload = extractFromPayload(payload);
  if (fromPayload) {
    return fromPayload;
  }

  const statusText = response?.statusText?.trim();
  if (statusText) {
    return statusText;
  }

  return fallback;
}

function extractFromPayload(payload: unknown): string | null {
  if (typeof payload === "string") {
    const normalized = payload.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (payload && typeof payload === "object") {
    const candidate = (payload as Record<string, unknown>).error;
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return null;
}

