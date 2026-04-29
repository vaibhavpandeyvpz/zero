import { useEffect, useRef } from "react";

export function useAutoScroll(dependencies: readonly unknown[]) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, dependencies);

  return scrollRef;
}
