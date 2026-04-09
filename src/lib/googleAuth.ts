import { google } from "googleapis";

export function createGoogleJwt(scopes: string[] = []) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (key) {
    let finalKey = key.trim();

    // 1. Detect if it's a full JSON service account
    if (finalKey.startsWith("{")) {
      try {
        console.info("Google Auth: Detected JSON service account, extracting private_key.");
        const json = JSON.parse(finalKey);
        if (json.private_key) {
          finalKey = json.private_key;
        }
      } catch (err) {
        console.error("Google Auth: Failed to parse GOOGLE_PRIVATE_KEY as JSON", err);
      }
    }

    // 3. Handle escaped newlines (standard fix for Vercel / .env)
    finalKey = finalKey.replace(/\\n/g, "\n");

    if (!finalKey.includes("-----BEGIN")) {
      console.error("CRITICAL AUTH ERROR: Your GOOGLE_PRIVATE_KEY in .env.local is completely malformed. It MUST contain '-----BEGIN PRIVATE KEY-----'. You likely pasted the wrong value, truncated it, or missed the headers.");
      throw new Error("GOOGLE_PRIVATE_KEY is malformed in environment variables.");
    }

    key = finalKey;

    console.info(`Google Auth: Key prepared, length: ${finalKey.length}`);
    key = finalKey;
  } else {
    console.warn("GOOGLE_PRIVATE_KEY is missing from environment variables.");
  }

  return new google.auth.JWT({
    email,
    key: key || undefined,
    scopes,
  });
}

export default createGoogleJwt;
