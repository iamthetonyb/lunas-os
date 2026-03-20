/**
 * Google Calendar API helpers using raw fetch (no googleapis dependency).
 *
 * All functions require a valid OAuth2 access token with the
 * https://www.googleapis.com/auth/calendar scope.
 */

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

// ── Types ────────────────────────────────────────────────────────────────

interface GoogleCalendarEventInput {
  summary: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  description?: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  description?: string;
  htmlLink?: string;
  status?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function calendarRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  accessToken: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${CALENDAR_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Google Calendar API ${method} ${path} failed (${response.status}): ${err}`
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ── Calendar Operations ──────────────────────────────────────────────────

/**
 * Create an event on the user's primary Google Calendar.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: GoogleCalendarEventInput
): Promise<GoogleCalendarEvent> {
  const body = {
    summary: event.summary,
    start: { dateTime: event.start, timeZone: "UTC" },
    end: { dateTime: event.end, timeZone: "UTC" },
    description: event.description,
  };

  return calendarRequest<GoogleCalendarEvent>(
    "POST",
    "/calendars/primary/events",
    accessToken,
    body
  );
}

/**
 * List events from the user's primary Google Calendar within a time range.
 *
 * @param timeMin - RFC 3339 start time (e.g. "2026-03-20T00:00:00Z")
 * @param timeMax - RFC 3339 end time (e.g. "2026-03-27T23:59:59Z")
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const result = await calendarRequest<{ items: GoogleCalendarEvent[] }>(
    "GET",
    "/calendars/primary/events",
    accessToken,
    undefined,
    {
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    }
  );

  return result.items ?? [];
}
