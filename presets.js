// Furniture preset definitions
// Each preset has a name and a list of cuts: { name, width, height, qty }
// Dimensions are in mm by default

const FURNITURE_PRESETS = {
  chair: {
    name: "Chair",
    cuts: [
      { name: "Leg", width: 50, height: 400, qty: 4 },
      { name: "Seat", width: 400, height: 400, qty: 1 },
      { name: "Back Slat", width: 80, height: 300, qty: 2 },
    ],
  },
  table: {
    name: "Table",
    cuts: [
      { name: "Leg", width: 60, height: 700, qty: 4 },
      { name: "Top", width: 600, height: 1000, qty: 1 },
    ],
  },
  shelf: {
    name: "Shelf",
    cuts: [
      { name: "Side", width: 200, height: 800, qty: 2 },
      { name: "Shelf Board", width: 200, height: 600, qty: 3 },
    ],
  },
  bedFrame: {
    name: "Bed Frame",
    cuts: [
      { name: "Long Rail", width: 100, height: 2000, qty: 2 },
      { name: "Short Rail", width: 100, height: 1500, qty: 2 },
      { name: "Slat", width: 80, height: 1500, qty: 12 },
    ],
  },
};
