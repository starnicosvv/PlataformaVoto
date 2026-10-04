const XLSX = require('xlsx');

const wb = XLSX.readFile('C:\\Users\\Nicolás\\Desktop\\para imprimir carmen fernandez.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const headers = rawData[0];
console.log('Headers:', headers);

const rows = rawData.slice(1);
console.log('Total rows:', rows.length);

const converted = [];
let skipped = 0;

rows.forEach((row, idx) => {
    // Column mapping:
    // 0: Nº DE REGISTRO
    // 1: desc_sec
    // 2: LOCAL
    // 3: LOCAL DE VOTACION
    // 4: MESA
    // 5: ORDEN
    // 6: CEDULA
    // 7: NOMBRE
    // 8: APELLIDO
    // 9: FECHA DE NACIMIENTO
    // 10: AFILIACION
    // 11: REFERENTE
    // 12: ZONA DEL REFERENTE
    // 13: Nº DE TELEFONO DEL REFERENTE
    // 14: VOTO

    const mesa = row[4] ? parseInt(String(row[4]).trim()) : null;
    const orden = row[5] ? parseInt(String(row[5]).trim()) : null;
    const cedula = String(row[6] || '').trim().replace(/\D/g, '');
    const nombre = String(row[7] || '').trim();
    const apellido = String(row[8] || '').trim();
    const referente = String(row[11] || '').trim();
    const zona_votacion = String(row[12] || '').trim() || String(row[3] || '').trim();

    const nombreCompleto = `${nombre} ${apellido}`.trim();

    if (cedula && nombreCompleto && cedula.length >= 6) {
        converted.push({
            cedula,
            nombre: nombreCompleto,
            orden,
            mesa,
            referente: referente || null,
            zona_votacion: zona_votacion || null
        });
    } else {
        skipped++;
    }
});

console.log('Converted:', converted.length);
console.log('Skipped (no cedula/nombre):', skipped);

// Save as new Excel
const newWs = XLSX.utils.json_to_sheet(converted);
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, newWs, 'padron');
XLSX.writeFile(newWb, 'padron_carmen_importar.xlsx');

console.log('Saved to padron_carmen_importar.xlsx');

console.log('\nFirst 5 records:');
console.log(converted.slice(0, 5));