// Both faces start blank; lists are created in-app via the Create List buttons.
export function seed() {
  return {
    version: 2,
    clock: 0,
    front: {
      top: null,
      middle: [],
      bottom: null,
      sizes: { top: 0.18, bottom: 0.18 },
      links: [],
    },
    back: { lists: [], links: [] },
  }
}
