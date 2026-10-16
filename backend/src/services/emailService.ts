import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const webhookUrl = env.notifications.passwordResetWebhookUrl;
  if (!webhookUrl) {
    throw new AppError("Password reset email is unavailable. Please contact your administrator.", 503, "EMAIL_UNAVAILABLE");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, resetLink }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new AppError("Unable to send the reset email. Please try again later.", 503, "EMAIL_UNAVAILABLE");
  });

  if (!response.ok) {
    console.warn("[email] password reset notification failed", {
      status: response.status,
      recipientDomain: email.split("@")[1] ?? "unknown",
      resetPath: new URL(resetLink).pathname,
    });
    throw new AppError("Unable to send the reset email. Please try again later.", 503, "EMAIL_UNAVAILABLE");
  }

  console.info("[email] password reset notification sent", {
    recipientDomain: email.split("@")[1] ?? "unknown",
    resetPath: new URL(resetLink).pathname,
  });
}
