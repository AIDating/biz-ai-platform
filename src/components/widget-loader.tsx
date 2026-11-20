"use client";

import { useEffect } from "react";

export function WidgetLoader({ publicKey, locale = "ro" }: { publicKey: string; locale?: "ro" | "en" }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.dataset.key = publicKey;
    script.dataset.lang = locale;
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.getElementById("redline-launcher")?.remove();
      document.getElementById("redline-frame")?.remove();
    };
  }, [publicKey, locale]);
  return null;
}
