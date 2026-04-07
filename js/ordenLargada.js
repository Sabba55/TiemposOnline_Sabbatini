const ORDENLARGADA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1217848665&single=true&output=csv';

let ordenLargadaData = [];
let intervaloContador = null;

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
        const cacheBuster = `&t=${Date.now()}`;
        const response = await fetch(ORDENLARGADA_URL + cacheBuster);
        const text = await response.text();
        
        ordenLargadaData = parseCSV(text);
        
        renderOrdenLargada();
        actualizarContadorProximaLargada();
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

function formatearTiempoRestante(minutos) {
    if (minutos < 60) {
        return `${minutos} minutos`;
    }
    
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (minutosRestantes === 0) {
        return horas === 1 ? `1 hora` : `${horas} horas`;
    }
    
    const textoHoras = horas === 1 ? '1 hora' : `${horas} horas`;
    return `${textoHoras} y ${minutosRestantes} minutos`;
}

function encontrarProximasLargadas() {
    if (ordenLargadaData.length === 0) return [];
    
    const ahora = new Date();
    const tiempoActualEnMinutos = ahora.getHours() * 60 + ahora.getMinutes();
    const columnasSS = obtenerColumnasSS();
    
    let menorDiferencia = Infinity;
    let candidatos = [];

    // Primero encontramos la menor diferencia
    ordenLargadaData.forEach(piloto => {
        columnasSS.forEach(ss => {
            const tiempoLargada = convertirHorarioAMinutos(piloto[ss]);
            if (tiempoLargada !== Infinity) {
                const diferencia = tiempoLargada - tiempoActualEnMinutos;
                if (diferencia >= 0 && diferencia < menorDiferencia) {
                    menorDiferencia = diferencia;
                }
            }
        });
    });

    if (menorDiferencia === Infinity) return [];

    // Luego recolectamos TODOS los que tienen esa misma diferencia
    ordenLargadaData.forEach(piloto => {
        const nombre = piloto.Nombre || piloto.NOMBRE || '';
        const categoria = piloto.Categoria || piloto.CATEGORIA || '';
        
        columnasSS.forEach(ss => {
            const tiempoLargada = convertirHorarioAMinutos(piloto[ss]);
            if (tiempoLargada !== Infinity) {
                const diferencia = tiempoLargada - tiempoActualEnMinutos;
                if (diferencia === menorDiferencia) {
                    candidatos.push({
                        nombre,
                        categoria,
                        horario: piloto[ss],
                        ss,
                        minutosRestantes: Math.floor(diferencia)
                    });
                }
            }
        });
    });

    return candidatos;
}

function actualizarContadorProximaLargada() {
    const proximasLargadas = encontrarProximasLargadas();
    const containerContador = document.getElementById('proximaLargadaContainer');
    
    if (proximasLargadas.length === 0) {
        containerContador.innerHTML = '<div class="sin-largadas">🏁 No hay largadas programadas próximamente</div>';
        return;
    }

    const minutosRestantes = proximasLargadas[0].minutosRestantes;
    const segundosRestantes = 60 - new Date().getSeconds();

    let estadoTexto = '';
    let estadoClass = '';
    
    if (minutosRestantes === 0) {
        estadoTexto = '¡LARGANDO AHORA!';
        estadoClass = 'largando-ahora';
    } else if (minutosRestantes <= 5) {
        estadoTexto = `Próxima largada en ${minutosRestantes} min ${segundosRestantes}s`;
        estadoClass = 'urgente';
    } else if (minutosRestantes <= 15) {
        estadoTexto = `Próxima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'cercana';
    } else {
        estadoTexto = `Próxima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'normal';
    }

    // Construir info de cada piloto
    const pilotosHTML = proximasLargadas.map(p => `
        <div class="info-piloto">
            <div class="info-item">
                <span class="label">Piloto:</span>
                <span class="valor nombre">${p.nombre}</span>
            </div>
            <div class="info-item">
                <span class="label">Categoría:</span>
                <span class="valor">${p.categoria}</span>
            </div>
            <div class="info-item">
                <span class="label">PE:</span>
                <span class="valor">${p.ss.replace('SS', '')}</span>
            </div>
            <div class="info-item">
                <span class="label">Horario:</span>
                <span class="valor horario">${p.horario}</span>
            </div>
        </div>
        ${proximasLargadas.length > 1 ? '<hr class="separador-piloto">' : ''}
    `).join('');

    containerContador.innerHTML = `
        <div class="contador-card ${estadoClass}">
            <div class="contador-header">
                <h2 class="contador-titulo">${estadoTexto}</h2>
            </div>
            <div class="contador-body">
                ${pilotosHTML}
            </div>
        </div>
    `;
}

function renderOrdenLargada() {
    if (ordenLargadaData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">❌ No se encontraron ordenes de largadas.</div>';
        return;
    }

    const columnasSS = obtenerColumnasSS();
    
    const datosOrdenados = [...ordenLargadaData].sort((a, b) => {
        const tiempoA = obtenerHorarioMasTemplano(a, columnasSS);
        const tiempoB = obtenerHorarioMasTemplano(b, columnasSS);
        return tiempoA - tiempoB;
    });

    // Obtener hora actual para comparar (minuto exacto)
    const ahora = new Date();
    const tiempoActualEnMinutos = ahora.getHours() * 60 + ahora.getMinutes();

    let html = `
        <div class="category-section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
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
        
        // Verificar si ALGÚN horario de este piloto está largando ahora
        const estaLargando = columnasSS.some(ss => {
            const tiempoLargada = convertirHorarioAMinutos(piloto[ss]);
            return tiempoLargada !== Infinity && tiempoLargada === tiempoActualEnMinutos;
        });

        const claseVerde = estaLargando ? 'celda-largando' : '';

        html += `
            <tr>
                <td class="${claseVerde}">${index + 1}</td>
                <td class="${claseVerde}"><strong>${nombre}</strong></td>
                <td class="${claseVerde}"><strong>${categoria}</strong></td>
        `;

        columnasSS.forEach(ss => {
            const horario = piloto[ss] || '-';
            const tiempoLargada = convertirHorarioAMinutos(horario);
            const estaLargandoEste = tiempoLargada !== Infinity && tiempoLargada === tiempoActualEnMinutos;
            
            // Verde si está largando en este PE específico, azul normal si no
            html += `<td class="pe-horario-cell${estaLargandoEste ? ' celda-largando' : ''}">${horario}</td>`;
        });

        html += `</tr>`;
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

// Inicializar
loadData();
setInterval(loadData, 30000);

// Actualizar contador cada segundo
if (intervaloContador) {
    clearInterval(intervaloContador);
}
intervaloContador = setInterval(actualizarContadorProximaLargada, 1000);