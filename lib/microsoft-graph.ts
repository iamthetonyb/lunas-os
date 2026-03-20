/**
 * Microsoft Graph API helpers for calendar and mail operations.
 *
 * NOTE: For full type safety, install @microsoft/microsoft-graph-client:
 *   pnpm add @microsoft/microsoft-graph-client
 *
 * This module uses fetch-based REST calls to avoid the dependency for now,
 * but provides the same function signatures for easy migration.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface GraphRequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  accessToken: string;
  body?: unknown;
  params?: Record<string, string>;
}

async function graphRequest<T = unknown>(opts: GraphRequestOptions): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${opts.path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph API ${opts.method} ${opts.path} failed (${response.status}): ${err}`);
  }

  // DELETE returns 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

// ── Graph Client Factory ────────────────────────────────────────────────

/**
 * Returns a lightweight authenticated client object for Microsoft Graph.
 * Use this when you need to make custom Graph API calls.
 */
export function getGraphClient(accessToken: string) {
  return {
    get: <T = unknown>(path: string, params?: Record<string, string>) =>
      graphRequest<T>({ method: "GET", path, accessToken, params }),
    post: <T = unknown>(path: string, body: unknown) =>
      graphRequest<T>({ method: "POST", path, accessToken, body }),
    patch: <T = unknown>(path: string, body: unknown) =>
      graphRequest<T>({ method: "PATCH", path, accessToken, body }),
    delete: (path: string) =>
      graphRequest<void>({ method: "DELETE", path, accessToken }),
  };
}

// ── Calendar Operations ──────────────────────────────────────────────────

interface CalendarEventInput {
  subject: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  body?: string;
  location?: string;
}

interface GraphCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  bodyPreview?: string;
  location?: { displayName: string };
  webLink?: string;
}

/**
 * Create a calendar event in the user's Outlook calendar.
 */
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEventInput
): Promise<GraphCalendarEvent> {
  const body: Record<string, unknown> = {
    subject: event.subject,
    start: { dateTime: event.start, timeZone: "UTC" },
    end: { dateTime: event.end, timeZone: "UTC" },
  };

  if (event.body) {
    body.body = { contentType: "HTML", content: event.body };
  }
  if (event.location) {
    body.location = { displayName: event.location };
  }

  return graphRequest<GraphCalendarEvent>({
    method: "POST",
    path: "/me/events",
    accessToken,
    body,
  });
}

/**
 * List calendar events within a time range from the user's Outlook calendar.
 */
export async function listCalendarEvents(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<GraphCalendarEvent[]> {
  const result = await graphRequest<{ value: GraphCalendarEvent[] }>({
    method: "GET",
    path: "/me/calendarView",
    accessToken,
    params: {
      startDateTime,
      endDateTime,
      $orderby: "start/dateTime",
      $top: "50",
    },
  });

  return result.value;
}

// ── Mail Operations ──────────────────────────────────────────────────────

/**
 * Send an email via the user's Outlook mailbox using Microsoft Graph.
 */
export async function sendMail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  await graphRequest<void>({
    method: "POST",
    path: "/me/sendMail",
    accessToken,
    body: {
      message: {
        subject,
        body: { contentType: "HTML", content: body },
        toRecipients: [
          { emailAddress: { address: to } },
        ],
      },
      saveToSentItems: true,
    },
  });
}
