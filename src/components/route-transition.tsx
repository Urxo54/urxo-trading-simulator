"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;

    const element = containerRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Animate the already-rendered route. Avoid keying the wrapper by pathname:
    // that remounts every page subtree (including expensive chart components).
    element.animate(
      [
        { opacity: 0, transform: "translate3d(0, 5px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [pathname]);

  return (
    <div ref={containerRef} className="urxo-route-transition">
      {children}
    </div>
  );
}
