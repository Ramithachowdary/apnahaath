import Landing from "@/components/Landing";
import { DisplayToggles } from "@/components/app/ui";

/**
 * The public landing page is fully static (prerendered, CDN cacheable). Visitors who already have
 * a session cookie are sent to /app by the middleware before this page is served.
 */
export default function Home() {
  return <Landing toggles={<DisplayToggles />} />;
}
