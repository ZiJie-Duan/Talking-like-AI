const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SessionResponse {
  id: string;
  stage: string;
}

interface SessionOut {
  id: string;
  stage: string;
  user_issue: string | null;
  stage2_messages: Array<{ role: "user" | "ai"; content: string }>;
  stage3_messages: Array<{ role: "user" | "ai"; content: string }>;
  mood_ratings: Array<{ value: number; after_message_index: number }>;
  annotations: Array<{ message_index: number; content: string }>;
}

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export type { SessionResponse, SessionOut, SSEEvent };

// --- Plain requests ---

export async function createSession(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/`, { method: "POST" });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  return res.json();
}

export async function submitIssue(
  sessionId: string,
  content: string,
): Promise<SessionOut> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`submitIssue failed: ${res.status}`);
  return res.json();
}

export async function saveMoodRating(
  sessionId: string,
  value: number,
): Promise<SessionOut> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/stage2/mood`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`saveMoodRating failed: ${res.status}`);
  return res.json();
}

export async function completeStage3(
  sessionId: string,
): Promise<SessionOut> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/stage3/complete`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`completeStage3 failed: ${res.status}`);
  return res.json();
}

// --- SSE streaming helpers ---

async function* parseSSE(
  response: Response,
): AsyncGenerator<SSEEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const parts = buffer.split("\n\n");
      // Last element may be incomplete — keep it in the buffer
      buffer = parts.pop()!;

      for (const part of parts) {
        if (!part.trim()) continue;

        let event = "message";
        let dataStr = "";

        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) {
            event = line.slice(7);
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);
          }
        }

        if (dataStr) {
          try {
            yield { event, data: JSON.parse(dataStr) };
          } catch {
            yield { event, data: { raw: dataStr } };
          }
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim()) {
      let event = "message";
      let dataStr = "";
      for (const line of buffer.split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          dataStr = line.slice(6);
        }
      }
      if (dataStr) {
        try {
          yield { event, data: JSON.parse(dataStr) };
        } catch {
          yield { event, data: { raw: dataStr } };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamStage2Chat(
  sessionId: string,
  content: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/stage2/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error(`streamStage2Chat failed: ${res.status}`);
  yield* parseSSE(res);
}

export async function* streamCompleteStage2(
  sessionId: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/stage2/complete`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`streamCompleteStage2 failed: ${res.status}`);
  yield* parseSSE(res);
}

export async function* streamStage3Chat(
  sessionId: string,
  content: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/stage3/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error(`streamStage3Chat failed: ${res.status}`);
  yield* parseSSE(res);
}
