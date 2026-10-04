const XLSX = require('xlsx');

const wb = XLSX.readFile('Libro1.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const headers = rawData[0];
console.log('Headers:', headers);

const rows = rawData.slice(1);
console.log('Total rows:', rows.length);

const converted = [];
let skipped = 0;

rows.forEach((row, idx) => {
    const mesa = row[0] ? parseInt(String(row[0]).trim()) : null;
    const orden = row[1] ? parseInt(String(row[1]).trim()) : null;
    const cedula = String(row[2] || '').trim().replace(/\D/g, '');
    const nombre = String(row[3] || '').trim();
    const apellido = String(row[4] || '').trim();
    const referente = String(row[5] || '').trim();

    const nombreCompleto = `${nombre} ${apellido}`.trim();

    if (cedula && nombreCompleto && cedula.length >= 6) {
        converted.push({
            cedula,
            nombre: nombreCompleto,
            orden,
            mesa,
            referente: referente || null,
            zona_votacion: null
        });
    } else {
        skipped++;
    }
});

console.log('Converted:', converted.length);
console.log('Skipped (no cedula/nombre):', skipped);

const newWs = XLSX.utils.json_to_sheet(converted);
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, newWs, 'padron');
XLSX.writeFile(newWb, 'padron_importar.xlsx');

console.log('Saved to padron_importar.xlsx');

console.log('\nFirst 5 records:');
console.log(converted.slice(0, 5));