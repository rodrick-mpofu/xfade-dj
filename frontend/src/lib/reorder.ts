/**
 * List reordering, pure so the planner's behaviour is testable without a DOM.
 *
 * Both return the original array reference when nothing would change, so callers
 * can skip a needless round trip to the backend.
 */

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const inRange = (index: number) => index >= 0 && index < items.length;
  if (from === to || !inRange(from) || !inRange(to)) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, position) => position !== index);
}
