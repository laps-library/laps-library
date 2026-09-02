type Handler = () => void;
const handlers: Record<string, Set<Handler>> = {};

export function onMenuEvent(name: string, h: Handler) {
  if (!handlers[name]) handlers[name] = new Set();
  handlers[name].add(h);
  return () => {
    handlers[name]?.delete(h);
  };
}

export function emitMenuEvent(name: string) {
  handlers[name]?.forEach((h) => {
    try {
      h();
    } catch (_) {}
  });
}
