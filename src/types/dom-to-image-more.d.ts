// src/types/dom-to-image-more.d.ts
declare module "dom-to-image-more" {
  export function toPng(node: HTMLElement, options?: unknown): Promise<string>;
}
