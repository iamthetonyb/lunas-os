import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Token buffer: refresh 5 minutes before actual expiry
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

interface TokenResult {
  accessToken: string;
  expiresAt: number;
}

/**
 * Refresh a Microsoft OAuth token using the refresh_token grant.
 */
async function refreshMicrosoftToken(refreshToken: string): Promise<TokenResult> {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AZURE_AD_CLIENT_ID and AZURE_AD_CLIENT_SECRET must be set");
  }

  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Microsoft token refresh failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh a Google OAuth token using the refresh_token grant.
 */
async function refreshGoogleToken(refreshToken: string): Promise<TokenResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    // Google returns expires_in (seconds). New refresh tokens are NOT always returned.
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Get a valid (non-expired) access token for a user + provider.
 * Automatically refreshes the token if it's expired or about to expire.
 *
 * @param userId - Convex user ID
 * @param provider - "google" or "microsoft"
 * @returns Valid access token string
 * @throws If no account exists, no refresh token, or refresh fails
 */
export async function getValidToken(
  userId: string,
  provider: "google" | "microsoft"
): Promise<string> {
  const convex = getConvex();

  const account = await convex.query(api.oauthAccounts.getByUserProvider, {
    userId: userId as Id<"users">,
    provider,
  });

  if (!account) {
    throw new Error(`No ${provider} account linked for user ${userId}`);
  }

  // Token still valid (with buffer)?
  if (account.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
    return account.accessToken;
  }

  // Need to refresh
  if (!account.refreshToken) {
    throw new Error(
      `${provider} token expired and no refresh token available. User must re-authenticate.`
    );
  }

  console.log(`[oauth] Refreshing ${provider} token for user ${userId}`);

  const refreshFn =
    provider === "microsoft" ? refreshMicrosoftToken : refreshGoogleToken;
  const refreshed = await refreshFn(account.refreshToken);

  // Persist the new token
  await convex.mutation(api.oauthAccounts.updateToken, {
    userId: userId as Id<"users">,
    provider,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
  });

  return refreshed.accessToken;
}
