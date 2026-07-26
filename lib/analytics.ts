import posthog from "posthog-js";

/** Client-side event capture; silent no-op when PostHog isn't configured. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
