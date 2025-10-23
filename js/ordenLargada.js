const ORDENLARGADA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1217848665&single=true&output=csv';

let ordenLargadaData = [];

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        
        const nombre = obj.Nombre || obj.NOMBRE || '';
        const categoria = obj.Categoria || obj.CATEGORIA || '';
        
        if (nombre && categoria) {
            data.push(obj);
        }
    }
    
    return data;
}

async function loadData() {
    try {
        const response = await fetch(ORDENLARGADA_URL);
        const text = await response.text();
        
        ordenLargadaData = parseCSV(text);
        
        renderOrdenLargada();
        updateLastUpdate();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠️ Error al cargar los datos. Por favor, verifica que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

function obtenerColumnasSS() {
    if (ordenLargadaData.length === 0) return [];
    
    const primeraFila = ordenLargadaData[0];
    const columnasSS = Object.keys(primeraFila)
        .filter(key => key.match(/^SS\d+$/))
        .sort((a, b) => {
            const numA = parseInt(a.replace('SS', ''));
            const numB = parseInt(b.replace('SS', ''));
            return numA - numB;
        });
    
    return columnasSS;
}

function convertirHorarioAMinutos(horario) {
    if (!horario || horario === '-') return Infinity;
    
    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;
    
    const horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    return horas * 60 + minutos;
}

function obtenerHorarioMasTemplano(piloto, columnasSS) {
    let minTiempo = Infinity;
    
    columnasSS.forEach(ss => {
        const horario = piloto[ss];
        const tiempo = convertirHorarioAMinutos(horario);
        if (tiempo < minTiempo) {
            minTiempo = tiempo;
        }
    });
    
    return minTiempo;
}

function renderOrdenLargada() {
    if (ordenLargadaData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">❌ No se encontraron ordenes de largadas.</div>';
        return;
    }

    const columnasSS = obtenerColumnasSS();
    
    // Ordenar los datos por horario más temprano
    const datosOrdenados = [...ordenLargadaData].sort((a, b) => {
        const tiempoA = obtenerHorarioMasTemplano(a, columnasSS);
        const tiempoB = obtenerHorarioMasTemplano(b, columnasSS);
        return tiempoA - tiempoB;
    });

    let html = `
        <div class="category-section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Piloto</th>
                            <th>Categoría</th>
    `;

    columnasSS.forEach(ss => {
        const numero = ss.replace('SS', '');
        html += `<th>PE ${numero}</th>`;
    });

    html += `
                        </tr>
                    </thead>
                    <tbody>
    `;

    datosOrdenados.forEach((piloto, index) => {
        const nombre = piloto.Nombre || piloto.NOMBRE || '';
        const categoria = piloto.Categoria || piloto.CATEGORIA || '';

        html += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td><strong>${nombre}</strong></td>
                <td>${categoria}</td>
        `;

        columnasSS.forEach(ss => {
            const horario = piloto[ss] || '-';
            html += `<td>${horario}</td>`;
        });

        html += `
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('content').innerHTML = html;
}

function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent = 
        `🔄 Última actualización: ${timeStr}`;
}

loadData();
setInterval(loadData, 30000);