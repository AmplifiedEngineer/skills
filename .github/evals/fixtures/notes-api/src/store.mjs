const notes = new Map();
let nextId = 1;

export function add(text) {
  const id = nextId++;
  notes.set(id, { id, text });
  return id;
}

export function list() {
  return [...notes.values()];
}

export function reset() {
  notes.clear();
  nextId = 1;
}
