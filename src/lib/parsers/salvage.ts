const CLOSE: Record<string, string> = { "{": "}", "[": "]" };

/**
 * Recovers JSON that was cut off mid-file (e.g. an interrupted phone-to-computer
 * transfer). Keeps everything up to the last complete value inside the
 * top-level container's arrays, then closes the open brackets.
 * Returns undefined if nothing usable can be recovered.
 */
export function salvageTruncatedJson(text: string): unknown | undefined {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let safeEnd = -1;
  let safeStack: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      // A value just closed at depth ≤ 2 (an element of a top-level array):
      // everything up to here is a consistent prefix.
      if (stack.length >= 1 && stack.length <= 2) {
        safeEnd = i + 1;
        safeStack = stack.slice();
      }
    }
  }
  if (stack.length === 0 || safeEnd < 0) return undefined;

  const closing = safeStack.reverse().map((b) => CLOSE[b]).join("");
  try {
    return JSON.parse(text.slice(0, safeEnd) + closing);
  } catch {
    return undefined;
  }
}
