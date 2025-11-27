const PILOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1122371230&single=true&output=csv';
const TRAMOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=0&single=true&output=csv';

let pilotosData = [];
let tramosData = [];
let peNumber = '';

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

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

function parseTramosCSV(csv) {
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
        
        if (obj.PE && obj.PE !== '') {
            data.push(obj);
        }
    }
    
    return data;
}

function corregirFormatoTiempo(timeStr) {
    if (!timeStr || timeStr === '') return '';
    
    let tiempo = timeStr.trim();
    const separadores = (tiempo.match(/[:.,]/g) || []).length;
    
    if (separadores === 2) {
        const partes = tiempo.split(/[:.,]/);
        if (partes.length === 3) {
            tiempo = `${partes[0]}:${partes[1]}.${partes[2]}`;
        }
    } else if (separadores === 1) {
        tiempo = tiempo.replace(/[,]/, '.');
    }
    
    return tiempo;
}

function esDNF(timeStr) {
    if (!timeStr) return false;
    const valorLimpio = timeStr.trim().toUpperCase();
    return valorLimpio === 'DNF' || valorLimpio === 'D.N.F' || valorLimpio === 'D.N.F.';
}

function timeToSeconds(timeStr) {
    if (!timeStr || timeStr === '') return 999999;
    
    if (esDNF(timeStr)) return 999999;
    
    timeStr = corregirFormatoTiempo(timeStr);
    
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 999999;
}

function secondsToTime(seconds) {
    if (seconds >= 999999) return '-';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(2);
    
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(5, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(5, '0')}`;
}

function formatDifference(diffSeconds) {
    if (diffSeconds === 0) return '-';
    return '+' + secondsToTime(diffSeconds);
}

function calcularVelocidadPromedio(tiempoSegundos, distanciaKm) {
    if (tiempoSegundos >= 999999 || !distanciaKm || distanciaKm === '') return '-';
    
    const distancia = parseFloat(distanciaKm);
    if (isNaN(distancia) || distancia <= 0) return '-';
    
    const tiempoHoras = tiempoSegundos / 3600;
    const velocidad = distancia / tiempoHoras;
    
    return velocidad.toFixed(0);
}

function obtenerPeorTiempoCategoria(pilotosCategoria) {
    let peorTiempo = 0;
    
    pilotosCategoria.forEach(piloto => {
        if (piloto.tiempoSegundos < 999999 && piloto.tiempoSegundos > peorTiempo) {
            peorTiempo = piloto.tiempoSegundos;
        }
    });
    
    return peorTiempo;
}

function calcularTiempoDNF(peorTiempoCategoria) {
    return peorTiempoCategoria + 60;
}

async function loadData() {
    try {
        const [pilotosResponse, tramosResponse] = await Promise.all([
            fetch(PILOTOS_URL),
            fetch(TRAMOS_URL)
        ]);
        
        const pilotosText = await pilotosResponse.text();
        const tramosText = await tramosResponse.text();
        
        pilotosData = parseCSV(pilotosText);
        tramosData = parseTramosCSV(tramosText);
        
        renderResults();
        updateLastUpdate();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

function mostrarInfoTramo() {
    peNumber = getQueryParam('pe');
    const tramoActual = tramosData.find(t => t.PE === peNumber);
    
    if (tramoActual) {
        const desde = tramoActual.Desde || '';
        const hasta = tramoActual.Hasta || '';
        const kms = tramoActual.KMS || '';
        const hora = tramoActual.HORA || '';
        
        let nombreTramo = '';
        if (desde && hasta) {
            nombreTramo = `${desde} - ${hasta}`;
        }
        
        let detallesHTML = '';
        if (kms) {
            detallesHTML += `<span class="tramo-detail-item"><strong>Distancia:</strong> ${kms} km</span>`;
        }
        if (hora) {
            detallesHTML += `<span class="tramo-detail-item"><strong>Hora:</strong> ${hora}</span>`;
        }
        
        const tramoInfoDiv = document.getElementById('tramoInfo');
        tramoInfoDiv.innerHTML = `
            <div>${nombreTramo}</div>
            ${detallesHTML ? `<div class="tramo-details">${detallesHTML}</div>` : ''}
        `;
        tramoInfoDiv.style.display = 'block';
    }
}

function renderResults() {
    peNumber = getQueryParam('pe');
    const peNumero = parseInt(peNumber);
    document.getElementById('title').textContent = `CLASIFICACIÓN GENERAL - PE ${peNumber}`;
    
    mostrarInfoTramo();

    if (pilotosData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠ No se encontraron datos de pilotos.</div>';
        return;
    }

    const ssColumn = `SS${peNumber}`;
    const tramoActual = tramosData.find(t => t.PE === peNumber);
    const distanciaTramo = tramoActual ? tramoActual.KMS : null;

    // Clasificación P.E. General
    const pilotosPE = pilotosData
        .filter(p => p[ssColumn])
        .map(p => {
            const valorTiempo = p[ssColumn];
            const tieneDNF = esDNF(valorTiempo);
            
            return {
                nombre: p.Nombre || p.NOMBRE || '',
                categoria: p.Categoria || p.CATEGORIA || '',
                tiempo: valorTiempo,
                tiempoSegundos: timeToSeconds(valorTiempo),
                tieneDNF: tieneDNF
            };
        })
        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    // Obtener el peor tiempo (excluyendo DNF)
    const peorTiempoPE = obtenerPeorTiempoCategoria(pilotosPE);
    
    // Procesar pilotos con DNF
    pilotosPE.forEach(piloto => {
        if (piloto.tieneDNF) {
            piloto.tiempoSegundos = calcularTiempoDNF(peorTiempoPE);
            piloto.tiempo = secondsToTime(piloto.tiempoSegundos);
        }
    });
    
    // Reordenar después de aplicar tiempos DNF
    pilotosPE.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const mejorTiempo = pilotosPE.length > 0 ? pilotosPE[0].tiempoSegundos : 0;

    let htmlPE = '<div class="section-title">Clasificación P.E.</div>';
    htmlPE += `
        <table>
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Piloto</th>
                    <th>Clase</th>
                    <th>Tiempo</th>
                    <th>Diferencia</th>
                    <th>PROM</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosPE.forEach((piloto, index) => {
        const diferencia = piloto.tiempoSegundos - mejorTiempo;
        const claseFilaDNF = piloto.tieneDNF ? 'fila-dnf' : '';
        const rowClass = index === 0 ? 'pos-1' : claseFilaDNF;
        const velocidadProm = calcularVelocidadPromedio(piloto.tiempoSegundos, distanciaTramo);
        const tiempoMostrar = piloto.tieneDNF ? 'DNF' : piloto.tiempo;

        htmlPE += `
            <tr class="${rowClass}">
                <td><strong>${index + 1}</strong></td>
                <td>${piloto.nombre}</td>
                <td>${piloto.categoria}</td>
                <td>${tiempoMostrar}</td>
                <td>${formatDifference(diferencia)}</td>
                <td>${velocidadProm}</td>
            </tr>
        `;
    });

    htmlPE += `
            </tbody>
        </table>
    `;

    // Clasificación General Acumulada
    const pilotosGeneral = pilotosData
        .map(p => {
            let totalSegundos = 0;
            let tuvoDNF = false;
            
            // Sumar todos los tramos del PE1 hasta el PE actual
            for (let i = 1; i <= peNumero; i++) {
                const columnaSS = `SS${i}`;
                const tiempo = p[columnaSS];
                
                if (!tiempo || tiempo === '') {
                    return null;
                }
                
                if (esDNF(tiempo)) {
                    // Calcular el peor tiempo de ESTE tramo específico
                    const pilotosEsteTramo = pilotosData
                        .filter(piloto => piloto[columnaSS])
                        .map(piloto => {
                            const valorTiempo = piloto[columnaSS];
                            return {
                                tiempoSegundos: timeToSeconds(valorTiempo),
                                tieneDNF: esDNF(valorTiempo)
                            };
                        })
                        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
                    
                    const peorTiempoTramo = obtenerPeorTiempoCategoria(pilotosEsteTramo);
                    totalSegundos += calcularTiempoDNF(peorTiempoTramo);
                    tuvoDNF = true;
                } else {
                    const segundos = timeToSeconds(tiempo);
                    if (segundos >= 999999) {
                        return null;
                    }
                    totalSegundos += segundos;
                }
            }
            
            const penalizacion = timeToSeconds(p.PENALIZACION || p.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;
            
            return {
                nombre: p.Nombre || p.NOMBRE || '',
                categoria: p.Categoria || p.CATEGORIA || '',
                totalSegundos: totalSegundos,
                penalizacionSegundos: penalizacionSegundos,
                totalConPenalizacion: totalConPenalizacion,
                tieneDNF: tuvoDNF
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

    const mejorTotal = pilotosGeneral.length > 0 ? pilotosGeneral[0].totalConPenalizacion : 0;

    let htmlGeneral = '<div class="section-title">Clasificación General</div>';
    htmlGeneral += `
        <table>
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Piloto</th>
                    <th>Clase</th>
                    <th>Tiempo</th>
                    <th>Penaliz</th>
                    <th>T. Total</th>
                    <th>Dif. 1°</th>
                    <th>Dif. Ant.</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosGeneral.forEach((piloto, index) => {
        const dif1 = piloto.totalConPenalizacion - mejorTotal;
        const difAnt = index > 0 ? piloto.totalConPenalizacion - pilotosGeneral[index - 1].totalConPenalizacion : 0;
        const rowClass = index === 0 ? 'pos-1' : (piloto.tieneDNF ? 'fila-dnf' : '');
        const tiempoFormateado = secondsToTime(piloto.totalSegundos);
        const penalizFormateada = piloto.penalizacionSegundos > 0 ? secondsToTime(piloto.penalizacionSegundos) : '-';
        const totalFormateado = secondsToTime(piloto.totalConPenalizacion);
        const penalizClass = piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : '';

        htmlGeneral += `
            <tr class="${rowClass}">
                <td><strong>${index + 1}</strong></td>
                <td>${piloto.nombre}</td>
                <td>${piloto.categoria}</td>
                <td>${tiempoFormateado}</td>
                <td class="${penalizClass}">${penalizFormateada}</td>
                <td>${totalFormateado}</td>
                <td>${formatDifference(dif1)}</td>
                <td>${formatDifference(difAnt)}</td>
            </tr>
        `;
    });

    htmlGeneral += `
            </tbody>
        </table>
    `;

    const html = `
        <div class="tables-container">
            <div class="table-column">${htmlPE}</div>
            <div class="table-column">${htmlGeneral}</div>
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