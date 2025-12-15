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
        
        // Extraer marca desde la primera palabra del vehículo
        let marca = '';
        if (vehiculo) {
            const vehiculoLower = vehiculo.toLowerCase();
            
            // Excepción especial: si contiene "skoda" y "rs", usar "skodars"
            if (vehiculoLower.includes('skoda') && vehiculoLower.includes('rs')) {
                marca = 'skodars';
            } else {
                // Comportamiento normal: primera palabra en minúsculas
                marca = vehiculo.split(' ')[0].toLowerCase();
            }
        }
        
        if (nombre && categoria) {
            data.push({
                numero: numero,
                nombre: nombre,
                marca: marca,
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
            categoriasInfo[cat] = {
                count: 1,
                colorIndex: (colorIndexCounter % 8) + 1
            };
            colorIndexCounter++;
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
                            <th>Marca</th>
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
                    <td colspan="5">
                        <span>CLASE: ${categoriaActual}</span>
                        <span class="category-count">INSCRIPTOS: ${info.count}</span>
                    </td>
                </tr>
            `;
        }

        // Badge para número
        const numeroBadge = inscripto.numero 
            ? `<span class="numero-badge">${inscripto.numero}</span>` 
            : '-';

        // Logo de marca
        const logoMarca = inscripto.marca 
            ? `<img src="/assets/icon/${inscripto.marca}.png" alt="${inscripto.marca}" class="marca-logo">` 
            : '-';

        html += `
            <tr>
                <td>${numeroBadge}</td>
                <td>${inscripto.nombre}</td>
                <td>${logoMarca}</td>
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
   EXPORTAR A PDF
========================== */
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape para más espacio

    // Título
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('INSCRIPTOS PROVISORIOS', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    // Fecha
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR');
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generado: ${dateStr} - ${timeStr}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    // Preparar datos por categoría
    const categoriasInfo = {};
    let colorIndexCounter = 0;
    
    inscriptosData.forEach(inscripto => {
        const cat = inscripto.categoria;
        if (!categoriasInfo[cat]) {
            categoriasInfo[cat] = {
                count: 1,
                colorIndex: (colorIndexCounter % 8) + 1,
                rows: []
            };
            colorIndexCounter++;
        } else {
            categoriasInfo[cat].count++;
        }
        categoriasInfo[cat].rows.push(inscripto);
    });

    // Generar tabla única con todas las categorías
    let startY = 30;
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = 260; // Ancho total de la tabla
    const marginLeft = (pageWidth - tableWidth) / 2; // Centrar
    
    // Preparar datos completos con separadores de categoría
    const allTableData = [];
    
    Object.keys(categoriasInfo).forEach((categoria, index) => {
        const info = categoriasInfo[categoria];
        
        // Agregar fila de categoría
        allTableData.push([
            { 
                content: `CLASE: ${categoria} - INSCRIPTOS: ${info.count}`, 
                colSpan: 4, 
                styles: { 
                    halign: 'center', 
                    fillColor: [30, 64, 175],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                } 
            }
        ]);
        
        // Agregar filas de inscriptos
        info.rows.forEach(inscripto => {
            allTableData.push([
                inscripto.numero || '-',
                inscripto.nombre,
                inscripto.vehiculo,
                inscripto.categoria
            ]);
        });
    });

    // Crear tabla única
    doc.autoTable({
        startY: startY,
        head: [
            ['Nº', 'Piloto', 'Vehículo', 'Categoría']
        ],
        body: allTableData,
        theme: 'grid', // 'grid' agrega bordes a todas las celdas
        headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            lineWidth: 0.3, // grosor del borde
            lineColor: [0, 0, 0] // color del borde (negro)
        },
        bodyStyles: {
            fontSize: 9,
            halign: 'center',
            lineWidth: 0.3, // grosor del borde del body
            lineColor: [150, 150, 150] // color del borde (gris)
        },
        alternateRowStyles: {
            fillColor: [243, 244, 246]
        },
        margin: { left: marginLeft, right: marginLeft },
        tableWidth: tableWidth,
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' }, // Nº - pequeña
            1: { cellWidth: 80, halign: 'center' }, // Piloto - más ancha
            2: { cellWidth: 110, halign: 'center' }, // Vehículo - más ancha
            3: { cellWidth: 45, halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' } // Categoría - pequeña
        }
    });

    // Footer en todas las páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Total de pilotos: ${inscriptosData.length} - Página ${i} de ${totalPages}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    // Guardar PDF
    doc.save(`inscriptos_${dateStr.replace(/\//g, '-')}.pdf`);
}

/* ==========================
   EVENT LISTENERS
========================== */
document.addEventListener('DOMContentLoaded', function() {
    const btnExportPDF = document.getElementById('btnExportPDF');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', exportToPDF);
    }
});

/* ==========================
   EJECUCIÓN INICIAL
========================== */
loadData();
setInterval(loadData, 300000); // 5 minutos