"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Patches window.fetch globally so that any API response with a 401 status
 * clears the local session and redirects to the login page.
 * Render once inside the root layout.
 */
export default function AuthGuard() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 401) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof URL
              ? args[0].href
              : args[0] instanceof Request
                ? args[0].url
                : "";

        if (url.startsWith("/api/")) {
          localStorage.clear();
          router.replace("/");
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}
