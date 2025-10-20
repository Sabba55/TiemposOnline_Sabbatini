const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=297990427&single=true&output=csv';

let inscriptosData = [];

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
        
        const numero = obj['Nº'] || obj.Nº || '';
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

async function loadData() {
    try {
        const response = await fetch(INSCRIPTOS_URL);
        const text = await response.text();
        
        inscriptosData = parseCSV(text);
        
        // Ordenar por categoría
        inscriptosData.sort((a, b) => {
            if (a.categoria < b.categoria) return -1;
            if (a.categoria > b.categoria) return 1;
            return 0;
        });
        
        renderInscriptos();
        updateLastUpdate();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠️ Error al cargar los datos. Por favor, verifica que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

function renderInscriptos() {
    if (inscriptosData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">❌ No se encontraron inscriptos.</div>';
        document.getElementById('contadorPilotos').textContent = '0';
        document.getElementById('contadorCategorias').innerHTML = '';
        return;
    }

    // Actualizar contador total
    document.getElementById('contadorPilotos').textContent = inscriptosData.length;

    // Contar pilotos por categoría
    const categorias = {};
    inscriptosData.forEach(inscripto => {
        const cat = inscripto.categoria;
        if (categorias[cat]) {
            categorias[cat]++;
        } else {
            categorias[cat] = 1;
        }
    });

    // Renderizar contador de categorías
    let categoriasHTML = '';
    Object.keys(categorias).sort().forEach(categoria => {
        categoriasHTML += `
            <div class="categoria-item">
                <div class="categoria-nombre">${categoria}</div>
                <div class="categoria-cantidad">${categorias[categoria]}</div>
            </div>
        `;
    });
    document.getElementById('contadorCategorias').innerHTML = categoriasHTML;

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

    inscriptosData.forEach((inscripto) => {
        html += `
            <tr>
                <td><strong>${inscripto.numero}</strong></td>
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