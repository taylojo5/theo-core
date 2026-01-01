import { KrogerTokenSet } from "../types";
import { DateTime } from "luxon";

export async function getKrogerAuthorizationUrl(
  state: string
): Promise<string> {
  // Get the authorization url
  const authorizationUrl = `${process.env.KROGER_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(process.env.KROGER_CLIENT_ID ?? "")}&redirect_uri=${encodeURIComponent(process.env.KROGER_REDIRECT_URI ?? "")}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(process.env.KROGER_SCOPES ?? "")}`;
  return authorizationUrl;
}

export async function exchangeKrogerCodeForTokenSet(
  code: string
): Promise<KrogerTokenSet> {
  // Exchange the code for a token by making a request to the Kroger API
  const tokenSetRes = await fetch(`${process.env.KROGER_TOKEN_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.KROGER_REDIRECT_URI ?? "",
    }),
  });

  if (!tokenSetRes.ok) {
    console.error(
      `[Kroger] Failed to exchange code for token set: ${tokenSetRes.statusText}. Response: ${await tokenSetRes.text()}`
    );
    throw new Error("Failed to exchange code for token set");
  }

  const tokenSetData = await tokenSetRes.json();
  return {
    accessToken: tokenSetData.access_token,
    refreshToken: tokenSetData.refresh_token,
    expiresAt: DateTime.now()
      .plus({ seconds: tokenSetData.expires_in })
      .toJSDate(),
    tokenType: "Bearer",
    scopes: tokenSetData.scopes,
  };
}

export async function refreshKrogerTokenSet(
  tokenSet: KrogerTokenSet
): Promise<KrogerTokenSet> {
  // Refresh the token set using the refresh token
  const tokenSetRes = await fetch(`${process.env.KROGER_TOKEN_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenSet.refreshToken,
    }).toString(),
  });

  if (!tokenSetRes.ok) {
    throw new Error("Failed to refresh token set");
  }

  const tokenSetData = await tokenSetRes.json();
  return {
    accessToken: tokenSetData.access_token,
    refreshToken: tokenSetData.refresh_token,
    expiresAt: DateTime.now()
      .plus({ seconds: tokenSetData.expires_in })
      .toJSDate(),
    tokenType: "Bearer",
    scopes: tokenSetData.scopes,
  };
}
