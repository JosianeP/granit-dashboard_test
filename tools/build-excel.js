// Génère le chiffrier de mise à jour chiffré à partir de data.json
// usage : node build-excel.js <data.json> <sortie.xlsx> <motdepasse>
const ExcelJS = require('exceljs'); const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
(async () => {
  const [, , dataPath, outPath, password] = process.argv;
  const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const wb = await GE.buildWorkbook(ExcelJS, D, { password });
  const plain = await wb.xlsx.writeBuffer();
  const xp = await XP.fromDataAsync(plain);
  const enc = await xp.outputAsync({ password });
  fs.writeFileSync(outPath, enc);
  fs.writeFileSync(outPath.replace(/\.xlsx$/, '.plain.xlsx'), plain);
  console.log('Écrit', outPath, enc.length, 'octets;', wb.worksheets.length, 'feuilles');
})().catch(e => { console.error(e); process.exit(1); });
