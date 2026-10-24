// One-time script: updates src/data/products.json
//   - removes 5 products
//   - moves "Makai Chivda Diet" from Chips to the Chivda category
//
// Run from the project root (the snacks-app folder):   node update-products.js
// It stops without changing anything if a product is not found exactly once.
// To undo before committing:   git restore src/data/products.json

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'data', 'products.json');

const REMOVE = [
  'Potato Biscuit 100 Gm',
  'Alsi Chips',
  'Millet Curry Leaves Chips',
  'Peri Peri Chips',
  'Mango Nibal',
];
const MOVE_NAME = 'Makai Chivda Diet';
const CATEGORY_REFERENCE = 'Makai Chivda'; // a product already in the Chivda category

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

if (!fs.existsSync(FILE)) {
  console.error('Could not find ' + FILE + '\nRun this from the snacks-app folder.');
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const products = JSON.parse(raw);
if (!Array.isArray(products)) {
  console.error('products.json is not a list of products, so nothing was changed.');
  process.exit(1);
}

function findOne(name) {
  const hits = products.filter(p => norm(p.name) === norm(name));
  if (hits.length !== 1) {
    console.error(`Expected exactly 1 product named "${name}" but found ${hits.length}. Nothing was changed.`);
    process.exit(1);
  }
  return hits[0];
}

const toRemove = REMOVE.map(findOne);
const toMove = findOne(MOVE_NAME);
const chivdaCategory = findOne(CATEGORY_REFERENCE).category;

console.log(`Products before: ${products.length}\n`);
console.log('Removing:');
toRemove.forEach(p => console.log(`  - ${p.name}  (id ${p.id}, ${p.category}, Rs ${p.price}/${p.unit})`));

console.log(`\nMoving: ${toMove.name}  (id ${toMove.id})  "${toMove.category}"  ->  "${chivdaCategory}"`);
toMove.category = chivdaCategory;

const removeSet = new Set(toRemove);
const updated = products.filter(p => !removeSet.has(p));

const indent = raw.includes('\n') ? 2 : 0;
let out = JSON.stringify(updated, null, indent);
if (raw.endsWith('\n')) out += '\n';
fs.writeFileSync(FILE, out);

console.log(`\nProducts after: ${updated.length}`);
console.log('products.json updated.');

console.log('\nFor the Firebase console, note these ids (field "id" in each product document):');
toRemove.forEach(p => console.log(`  delete  id ${p.id}   ${p.name}`));
console.log(`  edit    id ${toMove.id}   ${toMove.name}   -> category: ${chivdaCategory}`);