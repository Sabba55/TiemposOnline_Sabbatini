const ORDENLARGADA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1217848665&single=true&output=csv';

let ordenLargadaData = [];
let ordenLargadaDataAnterior = [];
let horariosModificados = new Set();
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

function detectarCambiosHorarios(datosNuevos, datosAnteriores) {
    const cambios = new Set();
    
    if (datosAnteriores.length === 0) {
        return cambios;
    }
    
    const columnasSS = obtenerColumnasSS();
    
    datosNuevos.forEach(pilotoNuevo => {
        const nombreNuevo = pilotoNuevo.Nombre || pilotoNuevo.NOMBRE || '';
        
        const pilotoAnterior = datosAnteriores.find(p => {
            const nombreAnterior = p.Nombre || p.NOMBRE || '';
            return nombreAnterior === nombreNuevo;
        });
        
        if (pilotoAnterior) {
            columnasSS.forEach(ss => {
                const horarioNuevo = pilotoNuevo[ss] || '-';
                const horarioAnterior = pilotoAnterior[ss] || '-';
                
                if (horarioNuevo !== horarioAnterior) {
                    const claveHorario = `${nombreNuevo}_${ss}`;
                    cambios.add(claveHorario);
                }
            });
        }
    });
    
    return cambios;
}

async function loadData() {
    try {
        const response = await fetch(ORDENLARGADA_URL);
        const text = await response.text();
        
        const datosNuevos = parseCSV(text);
        
        horariosModificados = detectarCambiosHorarios(datosNuevos, ordenLargadaData);
        
        ordenLargadaDataAnterior = [...ordenLargadaData];
        ordenLargadaData = datosNuevos;
        
        renderOrdenLargada();
        actualizarContadorProximaLargada();
        updateLastUpdate();
        
        if (horariosModificados.size > 0) {
            setTimeout(() => {
                horariosModificados.clear();
                renderOrdenLargada();
            }, 60000);
        }
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

function encontrarProximaLargada() {
    if (ordenLargadaData.length === 0) return null;
    
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutosActuales = ahora.getMinutes();
    const tiempoActualEnMinutos = horaActual * 60 + minutosActuales;
    
    const columnasSS = obtenerColumnasSS();
    let proximaLargada = null;
    let menorDiferencia = Infinity;
    
    ordenLargadaData.forEach(piloto => {
        const nombre = piloto.Nombre || piloto.NOMBRE || '';
        const categoria = piloto.Categoria || piloto.CATEGORIA || '';
        
        columnasSS.forEach(ss => {
            const horario = piloto[ss];
            const tiempoLargada = convertirHorarioAMinutos(horario);
            
            if (tiempoLargada !== Infinity) {
                const diferencia = tiempoLargada - tiempoActualEnMinutos;
                
                if (diferencia >= 0 && diferencia < menorDiferencia) {
                    menorDiferencia = diferencia;
                    proximaLargada = {
                        nombre: nombre,
                        categoria: categoria,
                        horario: horario,
                        ss: ss,
                        minutosRestantes: Math.floor(diferencia)
                    };
                }
            }
        });
    });
    
    return proximaLargada;
}

function actualizarContadorProximaLargada() {
    const proximaLargada = encontrarProximaLargada();
    const containerContador = document.getElementById('proximaLargadaContainer');
    
    if (!proximaLargada) {
        containerContador.innerHTML = '<div class="sin-largadas">🏁 No hay largadas programadas próximamente</div>';
        return;
    }
    
    const minutosRestantes = proximaLargada.minutosRestantes;
    const segundosRestantes = 60 - new Date().getSeconds();
    const numeroSS = proximaLargada.ss.replace('SS', '');
    
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
    
    containerContador.innerHTML = `
        <div class="contador-card ${estadoClass}">
            <div class="contador-header">
                <h2 class="contador-titulo">${estadoTexto}</h2>
            </div>
            <div class="contador-body">
                <div class="info-piloto">
                    <div class="info-item">
                        <span class="label">Piloto:</span>
                        <span class="valor nombre">${proximaLargada.nombre}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Categoría:</span>
                        <span class="valor">${proximaLargada.categoria}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">PE:</span>
                        <span class="valor">${numeroSS}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Horario:</span>
                        <span class="valor horario">${proximaLargada.horario}</span>
                    </div>
                </div>
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

    // Obtener categorías únicas y asignar colores
    const categoriasUnicas = [...new Set(datosOrdenados.map(p => p.Categoria || p.CATEGORIA || ''))];
    const categoriasColor = {};
    categoriasUnicas.forEach((cat, index) => {
        categoriasColor[cat] = (index % 8) + 1;
    });

    // Obtener hora actual para comparar
    const ahora = new Date();
    const tiempoActualEnMinutos = ahora.getHours() * 60 + ahora.getMinutes();

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
        const colorIndex = categoriasColor[categoria];

        html += `
            <tr>
                <td class="categoria-col category-color-${colorIndex}"><span class="numero-badge">${index + 1}</span></td>
                <td class="categoria-col category-color-${colorIndex}"><strong>${nombre}</strong></td>
                <td class="categoria-col category-color-${colorIndex}"><strong>${categoria}</strong></td>
        `;

        columnasSS.forEach(ss => {
            const horario = piloto[ss] || '-';
            const claveHorario = `${nombre}_${ss}`;
            
            const fueModificado = horariosModificados.has(claveHorario);
            let claseExtra = fueModificado ? ' pe-horario-modificado' : '';
            
            // Verificar si está largando ahora
            const tiempoLargada = convertirHorarioAMinutos(horario);
            if (tiempoLargada !== Infinity && tiempoLargada <= tiempoActualEnMinutos) {
                claseExtra += ' pe-horario-largado';
            }
            
            html += `<td class="pe-horario-cell${claseExtra}">${horario}</td>`;
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
    const cambiosTexto = horariosModificados.size > 0 ? ` - ⚠️ ${horariosModificados.size} horario(s) modificado(s)` : '';
    document.getElementById('lastUpdate').textContent = 
        `🔄 Última actualización: ${timeStr}${cambiosTexto}`;
}

// Inicializar
loadData();
setInterval(loadData, 30000);

// Actualizar contador cada segundo
if (intervaloContador) {
    clearInterval(intervaloContador);
}
intervaloContador = setInterval(actualizarContadorProximaLargada, 1000);