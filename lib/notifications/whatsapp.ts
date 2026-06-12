/**
 * lib/notifications/whatsapp.ts
 *
 * WhatsApp delivery adapter. Default provider is Twilio; swap by setting
 * WHATSAPP_PROVIDER=stub to disable real sends in dev.
 *
 * Required env (Twilio):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   (e.g. "whatsapp:+14155238886")
 *
 * Optional:
 *   WHATSAPP_PROVIDER=twilio | stub   (default: twilio if creds present, else stub)
 */

type Provider = "twilio" | "stub";

function selectedProvider(): Provider {
  const explicit = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (explicit === "stub") return "stub";
  if (explicit === "twilio") return "twilio";
  // Auto-detect
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  ) {
    return "twilio";
  }
  return "stub";
}

function normalize(toNumber: string): string {
  const trimmed = toNumber.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function sendViaTwilio(toNumber: string, message: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;

  const params = new URLSearchParams();
  params.set("From", from);
  params.set("To", normalize(toNumber));
  params.set("Body", message);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio WhatsApp send failed (${res.status}): ${text}`);
  }
}

export async function sendWhatsApp(toNumber: string, message: string): Promise<void> {
  if (!toNumber) return;

  const provider = selectedProvider();
  if (provider === "stub") {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[whatsapp:stub] → ${toNumber}: ${message}`);
    }
    return;
  }

  await sendViaTwilio(toNumber, message);
}

export default { sendWhatsApp };
