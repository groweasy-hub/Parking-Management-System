import { env } from "../config/env";

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const webhookUrl = env.notifications.passwordResetWebhookUrl;
  if (!webhookUrl) {
    console.warn("[email] password reset webhook is not configured", {
      recipientDomain: email.split("@")[1] ?? "unknown",
      resetPath: new URL(resetLink).pathname,
    });
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, resetLink }),
  });

  if (!response.ok) {
    console.warn("[email] password reset notification failed", {
      status: response.status,
      recipientDomain: email.split("@")[1] ?? "unknown",
      resetPath: new URL(resetLink).pathname,
    });
    return;
  }

  console.info("[email] password reset notification sent", {
    recipientDomain: email.split("@")[1] ?? "unknown",
    resetPath: new URL(resetLink).pathname,
  });
}
