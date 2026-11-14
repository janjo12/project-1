export type RoomRequestError = Error & { status: number };

export function isRoomConnectionFailure(cause: unknown) {
  if (cause instanceof TypeError) return true;
  return cause instanceof Error && "status" in cause &&
    typeof cause.status === "number" && (cause.status === 404 || cause.status >= 500);
}

async function readJson(response: Response) {
  try { return await response.json() as unknown; }
  catch { throw new Error(`Multiplayer server returned invalid JSON (${response.status}).`); }
}

export async function requestRoom<T extends object>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/multiplayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await readJson(response);
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
      ? result.error
      : `Multiplayer request failed (${response.status}).`;
    const error = new Error(message) as RoomRequestError;
    error.status = response.status;
    throw error;
  }
  return result as T;
}

export async function pollRoom<T extends object>(code: string, playerId: string): Promise<T> {
  const query = new URLSearchParams({ code, playerId });
  const response = await fetch(`/api/multiplayer?${query}`, { cache: "no-store" });
  const result = await readJson(response);
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
      ? result.error
      : `Room update failed (${response.status}).`;
    const error = new Error(message) as RoomRequestError;
    error.status = response.status;
    throw error;
  }
  return result as T;
}
