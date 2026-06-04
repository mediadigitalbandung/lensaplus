"use client";

import { useEffect } from "react";

const PLACEHOLDER_HTML = `
  <span class="my-4 flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-primary-light text-sm font-medium text-primary">
    Gambar tidak tersedia
  </span>
`;

export function ArticleImageFallback() {
  useEffect(() => {
    const containers = document.querySelectorAll<HTMLElement>(".article-content");
    if (containers.length === 0) return;

    const handlers = new WeakMap<HTMLImageElement, () => void>();

    containers.forEach((container) => {
      container.querySelectorAll("img").forEach((img) => {
        const handler = () => {
          const wrapper = document.createElement("span");
          wrapper.innerHTML = PLACEHOLDER_HTML;
          const placeholder = wrapper.firstElementChild;
          if (placeholder && img.parentNode) {
            img.parentNode.replaceChild(placeholder, img);
          }
        };
        handlers.set(img, handler);
        img.addEventListener("error", handler);

        if (img.complete && img.naturalWidth === 0) {
          handler();
        }
      });
    });

    return () => {
      containers.forEach((container) => {
        container.querySelectorAll("img").forEach((img) => {
          const handler = handlers.get(img);
          if (handler) img.removeEventListener("error", handler);
        });
      });
    };
  }, []);

  return null;
}
