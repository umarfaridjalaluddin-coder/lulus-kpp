// Question-level diagrams for existing questions (question id -> visual spec).
// Specs are rendered by app/js/visuals.js. A diagram only depicts what the
// question already states; it must never show which answer is correct.
const car = (part) => ({ type: 'component', vehicle: 'car', part });
const moto = (part) => ({ type: 'component', vehicle: 'motorcycle', part });

export default {
  // Junctions
  'B1-LMP-005': { type: 'junction', shape: 'cross' },
  'B1-LMP-006': { type: 'junction', shape: 'T' },
  'B3-SMP-001': { type: 'junction', shape: 'cross', arrow: 'right' },
  'B3-SMP-002': { type: 'junction', shape: 'cross', arrow: 'straight' },
  'B3-SMP-005': { type: 'junction', shape: 'cross', arrow: 'left' },
  'B3-OLG-004': { type: 'junction', shape: 'cross', arrow: 'straight' },
  // Safe following distance
  'B3-JRK-004': { type: 'distance', seconds: 2, state: 'close' },
  'B3-JRK-005': { type: 'distance', seconds: 4 },
  'B3-JRK-006': { type: 'distance', seconds: 2, tow: true, counts: false },
  'B3-JRK-007': { type: 'distance', seconds: 2 },
  'B4-CCA-002': { type: 'distance', seconds: 2, wet: true, counts: false },
  // Motorcycle components (only where the part is named in the question)
  'B5-MSK-001': moto('fuel'),
  'B5-MSK-002': moto('battery'),
  'B5-MSK-003': moto('engine-oil'),
  'B5-MSK-004': moto('engine-oil'),
  'B5-MSK-005': moto('engine-oil'),
  'B5-MSK-006': moto('engine-oil'),
  'B5-MSK-007': moto('tyre'),
  'B5-MSK-008': moto('tyre'),
  'B5-MSK-009': moto('chain'),
  'B5-MSK-010': moto('chain'),
  'B5-MSK-011': moto('chain'),
  'B5-MSK-012': moto('brake'),
  'B5-MSK-013': moto('brake'),
  'B5-MSK-014': moto('brake'),
  'B5-MSK-015': moto('brake'),
  'B5-MSK-016': moto('battery'),
  'B5-MSK-017': moto('battery'),
  'B5-MSK-020': moto('lights'),
  'B5-MSK-021': moto('lights'),
  'B5-MSK-022': moto('rear-light'),
  'B5-MSK-024': moto('horn'),
  'B5-MSK-025': moto('mirror'),
  'B5-MSK-026': moto('battery'),
  // Car components
  'B5-MKR-001': car('fuel'),
  'B5-MKR-002': car('fuel'),
  'B5-MKR-003': car('engine-oil'),
  'B5-MKR-004': car('engine-oil'),
  'B5-MKR-005': car('engine-oil'),
  'B5-MKR-006': car('gearbox'),
  'B5-MKR-007': car('brake'),
  'B5-MKR-009': car('radiator'),
  'B5-MKR-010': car('battery'),
  'B5-MKR-011': car('battery'),
  'B5-MKR-013': car('lights'),
  'B5-MKR-015': car('tyre'),
  'B5-MKR-018': car('steering'),
  'B5-MKR-019': car('washer'),
};
