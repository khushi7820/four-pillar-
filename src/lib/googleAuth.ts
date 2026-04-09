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

    // 2. Strip surrounding quotes (if any)
    finalKey = finalKey.replace(/^"|"$/g, "");

    // 3. Handle escaped newlines
    finalKey = finalKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

    // 4. Extract and rebuild to fix ERR_OSSL_UNSUPPORTED
    let header = "-----BEGIN PRIVATE KEY-----";
    let footer = "-----END PRIVATE KEY-----";
    let bodyClean = "";

    const keyMatch = finalKey.match(/(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)/);
    if (keyMatch) {
      header = keyMatch[1];
      bodyClean = keyMatch[2];
      footer = keyMatch[3];
    } else {
      console.warn("Google Auth: Missing PEM headers, wrapping base64 payload automatically...");
      bodyClean = finalKey;
    }

    // Strip ALL whitespace/newlines from the payload
    bodyClean = bodyClean.replace(/\s+/g, "");
    
    // Automatically chunk to 64 characters per line
    const bodyChunked = bodyClean.match(/.{1,64}/g)?.join("\n") || bodyClean;
    finalKey = `${header}\n${bodyChunked}\n${footer}\n`;

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
