"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const MESSAGES: Record<string, { title: string; body: string }> = {
  busy: {
    title: "Our servers are a little busy right now",
    body:  "The AI analysis service is experiencing a spike in demand. This is usually temporary — please wait a moment and try uploading your sheet again.",
  },
  failed: {
    title: "Something went wrong",
    body:  "We hit an unexpected error while analysing your sheet. Please try again, and let us know if it keeps happening.",
  },
};

export default function ErrorBanner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const errorCode    = searchParams.get("error");
  const [visible, setVisible] = useState(!!errorCode);

  // Reset visibility if the param changes (e.g. user navigates back again)
  useEffect(() => {
    setVisible(!!errorCode);
  }, [errorCode]);

  if (!visible || !errorCode || !MESSAGES[errorCode]) return null;

  const { title, body } = MESSAGES[errorCode];

  function dismiss() {
    setVisible(false);
    // Clean the error param from the URL without a full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const clean = params.size ? `?${params}` : "/";
    router.replace(clean, { scroll: false });
  }

  return (
    <div
      role="alert"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div className="flex gap-4 bg-surface-container border border-outline-variant/40 rounded-xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <span
            className="material-symbols-outlined text-amber-400 text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-inter font-semibold text-label-lg text-on-surface mb-0.5">
            {title}
          </p>
          <p className="font-inter text-body-sm text-on-surface-variant leading-relaxed">
            {body}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 self-start text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
