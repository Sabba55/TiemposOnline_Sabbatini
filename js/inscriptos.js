const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=297990427&single=true&output=csv';

let inscriptosData = [];

/* ==========================
   PARSEADOR CSV
========================== */
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};

        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });

        const numero = obj['Nº'] || '';
        const nombre = obj.NOMBRE || '';
        const vehiculo = obj.VEHICULO || '';
        const categoria = obj.CATEGORIA || '';
        
        if (nombre && categoria) {
            data.push({
                numero: numero,
                nombre: nombre,
                vehiculo: vehiculo,
                categoria: categoria
            });
        }
    }
    
    return data;
}

/* ==========================
   CARGA DE DATOS
========================== */
async function loadData() {
    try {
        const response = await fetch(INSCRIPTOS_URL);
        const text = await response.text();
        
        inscriptosData = parseCSV(text);
        
        // Ordenar por categoría alfabéticamente
        inscriptosData.sort((a, b) => a.categoria.localeCompare(b.categoria));
        
        renderInscriptos();
        updateLastUpdate();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠️ Error al cargar los datos. Por favor, verifica que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

/* ==========================
   RENDER PRINCIPAL
========================== */
function renderInscriptos() {
    const contentElement = document.getElementById('content');
    const contadorElement = document.getElementById('contadorPilotos');
    
    if (!contentElement || !contadorElement) return;

    if (inscriptosData.length === 0) {
        contentElement.innerHTML = 
            '<div class="error">❌ No se encontraron inscriptos.</div>';
        contadorElement.textContent = '0';
        return;
    }

    contadorElement.textContent = inscriptosData.length;

    // Conteo + asignación de color por categoría
    const categoriasInfo = {};
    let colorIndexCounter = 0;
    
    inscriptosData.forEach(inscripto => {
        const cat = inscripto.categoria;

        if (!categoriasInfo[cat]) {

            // ← ← ← **FIX APLICADO AQUÍ**
            categoriasInfo[cat] = {
                count: 1,
                colorIndex: (colorIndexCounter % 8) + 1
            };
            colorIndexCounter++;
            // ← ← ← **FIN DEL FIX**

        } else {
            categoriasInfo[cat].count++;
        }
    });

    let html = `
        <div class="category-section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Piloto</th>
                            <th>Vehículo</th>
                            <th>Categoría</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    let categoriaActual = '';

    inscriptosData.forEach((inscripto) => {
        if (inscripto.categoria !== categoriaActual) {
            categoriaActual = inscripto.categoria;
            const info = categoriasInfo[categoriaActual];

            html += `
                <tr class="category-header category-color-${info.colorIndex}">
                    <td colspan="4">
                        <span>CLASE: ${categoriaActual}</span>
                        <span class="category-count">INSCRIPTOS: ${info.count}</span>
                    </td>
                </tr>
            `;
        }

        html += `
            <tr>
                <td>${inscripto.numero}</td>
                <td>${inscripto.nombre}</td>
                <td>${inscripto.vehiculo}</td>
                <td>${inscripto.categoria}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contentElement.innerHTML = html;
}

/* ==========================
   ACTUALIZADOR DE FECHA/HORA
========================== */
function updateLastUpdate() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (!lastUpdateElement) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('es-AR');
    
    lastUpdateElement.textContent = 
        `🔄 Última actualización: ${dateStr} - ${timeStr}`;
}

/* ==========================
   EJECUCIÓN INICIAL
========================== */
loadData();
setInterval(loadData, 300000); // 5 minutos
