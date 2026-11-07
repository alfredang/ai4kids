import { google } from "googleapis";
import { getLeadEmailConfig, getLeadSourceLabels, resolveSourceLabel } from "./site-settings";
import { getCredential } from "./secrets";

const OAuth2 = google.auth.OAuth2;

async function loadGmailCreds() {
  const [user, clientId, clientSecret, refreshToken] = await Promise.all([
    getCredential("gmail_user"),
    getCredential("gmail_client_id"),
    getCredential("gmail_client_secret"),
    getCredential("gmail_refresh_token"),
  ]);
  if (!user || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail OAuth credentials are not configured. Set gmail_user, gmail_client_id, gmail_client_secret, gmail_refresh_token in Settings → Credentials.",
    );
  }
  return { user, clientId, clientSecret, refreshToken };
}

async function getGmailClient() {
  const creds = await loadGmailCreds();
  const oauth2Client = new OAuth2(
    creds.clientId,
    creds.clientSecret,
    "https://developers.google.com/oauthplayground",
  );
  oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { gmail, user: creds.user };
}

function buildRawMessage(opts: {
  from: string;
  to: string;
  cc?: string[];
  replyTo: string;
  subject: string;
  html: string;
}): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.cc && opts.cc.length ? `Cc: ${opts.cc.join(", ")}` : null,
    `Reply-To: ${opts.replyTo}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ]
    .filter(Boolean)
    .join("\r\n");
  const body = Buffer.from(opts.html, "utf8").toString("base64");
  const raw = `${headers}\r\n\r\n${body}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export const LEAD_EMAIL_VARIABLES = [
  { token: "{NAME}", description: "Sender's name" },
  { token: "{EMAIL}", description: "Sender's email" },
  { token: "{PHONE}", description: "Sender's phone (blank if not provided)" },
  { token: "{COMPANY}", description: "Sender's company (blank if not provided)" },
  { token: "{MESSAGE}", description: "The message body" },
  { token: "{SOURCE}", description: "Raw source code (e.g. free-trial)" },
  { token: "{SOURCE_LABEL}", description: "Friendly source label (e.g. Free Trial) — configured below" },
] as const;

function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
  { escapeHtml }: { escapeHtml: boolean },
): string {
  return tpl.replace(/\{(NAME|EMAIL|PHONE|COMPANY|MESSAGE|SOURCE_LABEL|SOURCE)\}/g, (_, k) => {
    const v = vars[k] ?? "";
    return escapeHtml ? escape(v) : v;
  });
}

export async function sendLeadEmail(lead: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
  source?: string;
}) {
  const [cfg, labels, gmailClient] = await Promise.all([
    getLeadEmailConfig(),
    getLeadSourceLabels(),
    getGmailClient(),
  ]);
  const { gmail, user: fromUser } = gmailClient;

  const vars: Record<string, string> = {
    NAME: lead.name,
    EMAIL: lead.email,
    PHONE: lead.phone ?? "",
    COMPANY: lead.company ?? "",
    MESSAGE: lead.message,
    SOURCE: lead.source ?? "",
    SOURCE_LABEL: resolveSourceLabel(lead.source, labels),
  };

  const subject = renderTemplate(cfg.subject, vars, { escapeHtml: false });
  const html = renderTemplate(cfg.body, vars, { escapeHtml: true });
  const cc = cfg.cc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const raw = buildRawMessage({
    from: `"Tertiary Infotech Academy" <${fromUser}>`,
    to: cfg.to,
    cc,
    replyTo: lead.email,
    subject,
    html,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * Generic transactional email via the same Gmail OAuth client. Throws if Gmail
 * credentials are not configured — callers should catch and degrade gracefully.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  replyTo?: string;
  fromName?: string;
}): Promise<void> {
  const { gmail, user: fromUser } = await getGmailClient();
  const raw = buildRawMessage({
    from: `"${opts.fromName ?? "AI Kids Academy"}" <${fromUser}>`,
    to: opts.to,
    cc: opts.cc,
    replyTo: opts.replyTo ?? fromUser,
    subject: opts.subject,
    html: opts.html,
  });
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

export function isGmailConfigured(): Promise<boolean> {
  return loadGmailCreds()
    .then(() => true)
    .catch(() => false);
}
