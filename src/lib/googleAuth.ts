import { google } from "googleapis";

export function createGoogleJwt(scopes: string[] = []) {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (key) {
    let finalKey = key.trim();

    // 1. Strip surrounding quotes (Next.js .env might not strip them in Vercel when copy-pasted)
    finalKey = finalKey.replace(/^["']|["']$/g, '');

    // 2. Detect if it's a full JSON service account
    if (finalKey.startsWith("{")) {
      try {
        console.info("Google Auth: Detected JSON service account, extracting private_key.");
        const json = JSON.parse(finalKey);
        if (json.private_key) {
          finalKey = json.private_key;
        }
        if (json.client_email) {
          email = json.client_email;
          console.info(`Google Auth: Extracted client_email from JSON: ${email}`);
        }
      } catch (err) {
        console.error("Google Auth: Failed to parse GOOGLE_PRIVATE_KEY as JSON", err);
      }
    }

    // 3. Handle escaped newlines (standard fix for Vercel / .env)
    finalKey = finalKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

    // 4. Robust OpenSSL Re-chunker (Fixes ERR_OSSL_UNSUPPORTED where base64 is flattened)
    const keyMatch = finalKey.match(/(-----BEGIN PRIVATE KEY-----)([\s\S]*?)(-----END PRIVATE KEY-----)/);
    if (keyMatch) {
      const bodyClean = keyMatch[2].replace(/\s+/g, ""); // Strip ALL whitespace
      const bodyChunked = bodyClean.match(/.{1,64}/g)?.join("\n") || bodyClean;
      finalKey = `-----BEGIN PRIVATE KEY-----\n${bodyChunked}\n-----END PRIVATE KEY-----\n`;
    }

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
