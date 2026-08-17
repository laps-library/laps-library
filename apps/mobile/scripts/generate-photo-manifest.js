const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'assets', 'instruments');
const entries = [];

for (const brand of fs.readdirSync(root, { withFileTypes: true })) {
  if (!brand.isDirectory()) continue;
  const brandDir = path.join(root, brand.name);
  for (const model of fs.readdirSync(brandDir, { withFileTypes: true })) {
    if (!model.isDirectory()) continue;
    const photoPath = path.join(brandDir, model.name, 'photo.png');
    if (fs.existsSync(photoPath)) {
      entries.push({ brand: brand.name, model: model.name });
    }
  }
}

entries.sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));

const lines = entries.map((e) => {
  const key = JSON.stringify(`${e.brand}/${e.model}`);
  const reqPath = JSON.stringify(`./${e.brand}/${e.model}/photo.png`);
  return `  ${key}: require(${reqPath}),`;
});

const out = `// Généré automatiquement par scripts/generate-photo-manifest.js — ne pas éditer à la main
export const LOCAL_PHOTOS: Record<string, any> = {
${lines.join('\n')}
};
`;

fs.writeFileSync(path.join(root, 'manifest.ts'), out);
console.log(`OK — manifest.ts régénéré avec ${entries.length} photos.`);
