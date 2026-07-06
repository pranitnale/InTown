import Google from '@auth/core/providers/google';
import Nodemailer from '@auth/core/providers/nodemailer';
import type { Provider } from '@auth/core/providers';
import nodemailer from 'nodemailer';
import type { LoadedEnv } from '../config/env.ts';

/**
 * A captured magic-link, pushed by the email provider instead of hitting SMTP.
 * Used in dev/test so sign-in can be driven end-to-end without a mail server.
 */
export interface CapturedLink {
  identifier: string;
  url: string;
  token: string;
}

/**
 * In-process sink for magic-links. When one is provided to `buildProviders`,
 * the Nodemailer provider records the link here rather than sending an email.
 */
export interface LinkSink {
  push(link: CapturedLink): void;
}

/** A simple array-backed {@link LinkSink} with a helper to read the latest link. */
export class ArrayLinkSink implements LinkSink {
  readonly links: CapturedLink[] = [];
  push(link: CapturedLink): void {
    this.links.push(link);
  }
  get last(): CapturedLink | undefined {
    return this.links[this.links.length - 1];
  }
}

/**
 * Build the Auth.js providers: Google (OIDC) + magic-link email (Nodemailer).
 *
 * When `linkSink` is provided (dev/test), the email provider captures the
 * verification URL in-process instead of sending mail. In production (no sink),
 * it sends through the configured `EMAIL_SERVER` transport.
 */
export function buildProviders(env: LoadedEnv, linkSink?: LinkSink): Provider[] {
  const google = Google({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  });

  const email = Nodemailer({
    // The Nodemailer provider requires a truthy `server` at construction even
    // when `sendVerificationRequest` is overridden. In dev/test (no EMAIL_SERVER)
    // fall back to nodemailer's no-op JSON transport, which is never actually
    // used because our override captures the link instead of sending mail.
    server: env.EMAIL_SERVER ?? { jsonTransport: true },
    from: env.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url, token }) {
      if (linkSink) {
        linkSink.push({ identifier, url, token });
        return;
      }
      if (!env.EMAIL_SERVER) {
        throw new Error('EMAIL_SERVER is not configured; cannot send magic-link email.');
      }
      const transport = nodemailer.createTransport(env.EMAIL_SERVER);
      await transport.sendMail({
        to: identifier,
        from: env.EMAIL_FROM,
        subject: 'Sign in to InTown',
        text: `Sign in to InTown:\n${url}\n\nThis link expires shortly. If you did not request it, ignore this email.`,
      });
    },
  });

  return [google, email];
}
