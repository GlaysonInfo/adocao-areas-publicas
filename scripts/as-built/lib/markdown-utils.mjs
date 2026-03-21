export function mdList(items, mapFn, emptyText) {
  if (!items || items.length === 0) return `- ${emptyText}`;
  return items.map(mapFn).join("\n");
}

export function mdCodeBlock(content, lang = "") {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}