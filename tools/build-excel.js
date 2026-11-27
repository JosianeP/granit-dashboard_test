// Génère le chiffrier de mise à jour à partir de data.json et des fichiers de data/ (constats MADA, territoire apprenant).
// usage : node build-excel.js <data.json> <sortie.xlsx> [motdepasse]
// Sans mot de passe, le chiffrier n'est pas chiffré (cas normal depuis la v4.21 : son contenu est public une fois publié).
const ExcelJS = require('exceljs'); const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
function lireExtras(dataPath) {
  const racine = path.dirname(path.resolve(dataPath)), extras = {};
  GE.EXTRAS.forEach(e => { const f = path.join(racine, e.path); if (fs.existsSync(f)) extras[e.key] = JSON.parse(fs.readFileSync(f, 'utf8')); });
  return extras;
}
module.exports = { lireExtras };
if (require.main === module) (async () => {
  const [, , dataPath, outPath, password] = process.argv;
  const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const wb = await GE.buildWorkbook(ExcelJS, D, { extras: lireExtras(dataPath) });
  let buf = await wb.xlsx.writeBuffer();
  if (password) { const xp = await XP.fromDataAsync(buf); buf = await xp.outputAsync({ password }); }
  fs.writeFileSync(outPath, buf);
  console.log('Écrit', outPath, buf.length, 'octets;', wb.worksheets.length, 'feuilles' + (password ? ' (chiffré)' : ''));
})().catch(e => { console.error(e); process.exit(1); });
