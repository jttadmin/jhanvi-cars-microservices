import nodemailer from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Email delivery is not configured: ${name} is missing`
    );
  }

  return value;
}

export async function sendEmail(
  input: SendEmailInput
): Promise<void> {
  const host = getRequiredEnv("SMTP_HOST");
  const portValue = getRequiredEnv("SMTP_PORT");
  const from = getRequiredEnv("EMAIL_FROM");

  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Email delivery configuration has an invalid SMTP_PORT");
  }

  const secure = port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass !== undefined
      ? { auth: { user, pass } }
      : {})
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {})
  });
}
