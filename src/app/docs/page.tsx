"use client";

// ═══════════════════════════════════════════════════════════════════════════
// API Documentation Page
// Interactive API documentation powered by Scalar
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";

export default function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load Scalar when component mounts
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="api-reference"
      data-url="/api/openapi.json"
      data-configuration={JSON.stringify({
        // Theme options: default, alternate, moon, purple, solarized, 
        // kepler, mars, deepSpace, saturn, bluePlanet
        theme: "purple",
        layout: "modern",
        hideDownloadButton: false,
        searchHotKey: "k",
        showSidebar: true,
        darkMode: false, // Start in light mode
        defaultHttpClient: {
          targetKey: "javascript",
          clientKey: "fetch",
        },
        // Only override accent color, let theme handle the rest
        customCss: `
          .scalar-api-reference {
            --scalar-color-accent: #7c3aed;
          }
        `,
      })}
    />
  );
}
