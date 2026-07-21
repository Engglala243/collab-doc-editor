import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import InvitationEmail from "@/emails/InvitationEmail";
import React from "react";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendInviteParams {
  toEmail: string;
  documentTitle: string;
  documentId: string;
  role: "EDITOR" | "VIEWER";
  inviterName?: string;
  inviterEmail?: string;
}

export async function sendDocumentInviteEmail({
  toEmail,
  documentTitle,
  documentId,
  role,
  inviterName,
  inviterEmail,
}: SendInviteParams) {
  const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  };

  const documentUrl = `${getBaseUrl()}/documents/${documentId}`;
  
  const html = await render(
    React.createElement(InvitationEmail, {
      documentTitle,
      documentUrl,
      role,
      inviterName,
      inviterEmail,
    })
  );

  const options = {
    from: process.env.SMTP_FROM || `"Collab Doc Editor" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `You've been invited to collaborate on "${documentTitle}"`,
    html,
  };

  try {
    const info = await transporter.sendMail(options);
    console.log("Invitation email sent: ", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return false;
  }
}
