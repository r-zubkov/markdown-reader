import { useState } from "react";

import { Button } from "@/ui/primitives/button";

export function PwaUpdatePrompt() {
  const [supportsServiceWorker] = useState(() => "serviceWorker" in navigator);

  return (
    <aside
      aria-live="polite"
      className="mobile-platform-spike__pwa-status"
      data-pwa-supported={String(supportsServiceWorker)}
    >
      <p>
        {supportsServiceWorker
          ? "PWA lifecycle probe is ready; production registration supplies the update event."
          : "This browser does not expose service-worker support."}
      </p>
      <Button isDisabled variant="outline">
        Update when available
      </Button>
    </aside>
  );
}
