const TRAMOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=0&single=true&output=csv';
const PILOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1122371230&single=true&output=csv';
const RALLY_NAME_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1067104904&single=true&output=csv';
const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1217848665&single=true&output=csv';
const { analizarCSV } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo: formatearSegundos } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;

let tramosData = [];
let pilotosData = [];
let inscriptosData = [];

async function cargarNombreRally() {
    try {
        const response = await fetch(RALLY_NAME_URL);
        const text = await response.text();
        const data = analizarCSV(text);
        
        if (data.length > 0 && data[0].Nombre && data[0].Nombre.trim() !== '') {
            const nombreRally = data[0].Nombre.trim();
            document.getElementById('rallyName').textContent = nombreRally;
            document.title = nombreRally;
        }
    } catch (error) {
        console.error('Error al cargar el nombre del rally:', error);
    }
}

function segundosATiempo(segundos) {
    return formatearSegundos(segundos, 2);
}

function capitalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { 
        return a.toUpperCase(); 
    });
}

function contarRepeticionesTramo(desdeHasta, indiceActual) {
    let contador = 0;
    for (let i = 0; i <= indiceActual; i++) {
        const tramoActual = tramosData[i];
        const desdeActual = tramoActual.Desde || '';
        const hastaActual = tramoActual.Hasta || '';
        const textoActual = `${desdeActual} - ${hastaActual}`;
        
        if (textoActual === desdeHasta) {
            contador++;
        }
    }
    return contador;
}

function numeroARomano(num) {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[num - 1] || num.toString();
}

function obtenerGanadorPE(peNumber) {
    const ssColumn = `SS${peNumber}`;
    let mejorPiloto = null;
    let mejorTiempo = 999999;

    pilotosData.forEach(piloto => {
        const tiempo = piloto[ssColumn];
        if (tiempo && tiempo !== '') {
            const segundos = tiempoASegundos(tiempo);
            if (segundos < mejorTiempo) {
                mejorTiempo = segundos;
                mejorPiloto = {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    tiempo: tiempo,
                    clase: piloto.Categoria || piloto.CATEGORIA || ''
                };
            }
        }
    });

    return mejorPiloto;
}

function convertirHorarioAMinutos(horario) {
    if (!horario || horario === '-' || horario === '') return Infinity;
    
    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;
    
    const horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    return horas * 60 + minutos;
}

function obtenerHorarioMasTemplanoPE(peNumber) {
    const ssColumn = `SS${peNumber}`;
    let minTiempo = Infinity;
    let horarioMasTemplano = '';
    
    inscriptosData.forEach(inscripto => {
        const horario = inscripto[ssColumn];
        if (horario && horario !== '-' && horario !== '') {
            const tiempo = convertirHorarioAMinutos(horario);
            if (tiempo < minTiempo) {
                minTiempo = tiempo;
                horarioMasTemplano = horario;
            }
        }
    });
    
    return horarioMasTemplano;
}

function validarConsistenciaDatos() {
    const numeroPEs = tramosData.length;
    
    if (pilotosData.length === 0) {
        return { valido: false, mensaje: 'No hay datos de pilotos' };
    }
    
    const primeraFila = pilotosData[0];
    const columnasSS = Object.keys(primeraFila).filter(key => key.match(/^SS\d+$/));
    const numeroSS = columnasSS.length;
    
    if (numeroPEs !== numeroSS) {
        return {
            valido: false,
            mensaje: `⚠️ INCONSISTENCIA DE DATOS: ⚠️\n\n` +
                    `• PE en tabla de Tramos: ${numeroPEs}\n` +
                    `• Columnas SS en tabla de Pilotos: ${numeroSS}\n\n` +
                    `El número de PE debe coincidir con el número de columnas SS en la tabla de pilotos.\n` +
                    `Por favor, no seas boludo y corregi las hojas de cálculo.`
        };
    }
    
    return { valido: true };
}

async function cargarDatos() {
    try {
        const [tramosResponse, pilotosResponse, inscriptosResponse] = await Promise.all([
            fetch(TRAMOS_URL),
            fetch(PILOTOS_URL),
            fetch(INSCRIPTOS_URL)
        ]);
        
        const tramosText = await tramosResponse.text();
        const pilotosText = await pilotosResponse.text();
        const inscriptosText = await inscriptosResponse.text();
        
        tramosData = analizarCSV(tramosText);
        pilotosData = analizarCSV(pilotosText);
        inscriptosData = analizarCSV(inscriptosText);
        window.pilotosData = pilotosData;
        window.tramosData  = tramosData;
        
        const validacion = validarConsistenciaDatos();
        if (!validacion.valido) {
            alert(validacion.mensaje);
            document.getElementById('content').innerHTML = 
                '<div class="error"> ' + validacion.mensaje.replace(/\n/g, '<br>') + '</div>';
            return;
        }
        
        renderizarMenu();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠️ Error al cargar los datos. Por favor, verifica que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

function renderizarMenu() {
    if (tramosData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">❌ No se encontraron datos de tramos.</div>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>PE</th>
                    <th>Desde - Hasta</th>
                    <th>KMS</th>
                    <th>Hora</th>
                    <th>Resultados</th>
                    <th>Ganador</th>
                </tr>
            </thead>
            <tbody>
    `;

    tramosData.forEach((tramo, index) => {
        const pe = tramo.PE || '';
        const desde = tramo.Desde || '';
        const hasta = tramo.Hasta || '';
        
        let desdeHasta = '';
        if (desde && hasta) {
            const desdeCapitalizado = capitalizarTexto(desde);
            const hastaCapitalizado = capitalizarTexto(hasta);
            const textoBase = `${desdeCapitalizado} - ${hastaCapitalizado}`;
            const repeticion = contarRepeticionesTramo(`${desde} - ${hasta}`, index);
            const romano = numeroARomano(repeticion);
            desdeHasta = `${textoBase} (${romano})`;
        }
        
        const kms = tramo.KMS || '';
        const hora = obtenerHorarioMasTemplanoPE(pe);
        const ganador = obtenerGanadorPE(pe);
        
        let ganadorHTML = '-';
        if (ganador) {
            ganadorHTML = `
                <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">${ganador.nombre}</div>
                <div style="font-size: 12px; font-weight: 700; color: #404955;">
                    ${ganador.clase} | ${ganador.tiempo}
                </div>
            `;
        }

        html += `
            <tr>
                <td><span class="pe-number">${pe}</span></td>
                <td style="font-weight: 600;">${desdeHasta}</td>
                <td>${kms}</td>
                <td>${hora}</td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button class="btn-clases" onclick="verGeneral('${pe}')">
                            General
                        </button>
                        <button class="btn-clases" onclick="verClases('${pe}')">
                            Por Clases
                        </button>
                    </div>
                </td>
                <td class="ganador-cell">${ganadorHTML}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    document.getElementById('content').innerHTML = html;
    
    renderizarGanadoresFinales();
}

function verificarPEsCompletas() {
    const totalPEs = tramosData.length;
    
    const categorias = [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c);
    
    for (const categoria of categorias) {
        const pilotosCategoria = pilotosData.filter(p => (p.Categoria || p.CATEGORIA) === categoria);
        
        const algunoPilotoCompleto = pilotosCategoria.some(piloto => {
            for (let i = 1; i <= totalPEs; i++) {
                const columnaSS = `SS${i}`;
                const tiempo = piloto[columnaSS];
                if (!tiempo || tiempo === '') {
                    return false;
                }
            }
            return true;
        });
        
        if (algunoPilotoCompleto) {
            return true;
        }
    }
    
    return false;
}

function calcularClasificacionGeneral(totalPEs) {
    const todosLosPilotos = pilotosData
        .map(piloto => {
            let totalSegundos = 0;
            let tieneDatos = false;
            
            for (let i = 1; i <= totalPEs; i++) {
                const columnaSS = `SS${i}`;
                const tiempo = piloto[columnaSS];
                
                if (!tiempo || tiempo === '') {
                    return null;
                }
                
                tieneDatos = true;
                
                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = pilotosData
                        .filter(p => p[columnaSS])
                        .map(p => {
                            const valorTiempo = p[columnaSS];
                            return {
                                tiempoSegundos: tiempoASegundos(valorTiempo),
                                tieneDNF: esDNF(valorTiempo)
                            };
                        })
                        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
                    
                    const peorTiempoTramo = obtenerPeorTiempo(pilotosEsteTramo);
                    totalSegundos += calcularTiempoDNF(peorTiempoTramo);
                } else {
                    const segundos = tiempoASegundos(tiempo);
                    if (segundos >= 999999) {
                        return null;
                    }
                    totalSegundos += segundos;
                }
            }
            
            if (!tieneDatos) return null;
            
            const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;
            
            return {
                nombre: piloto.Nombre || piloto.NOMBRE || '',
                categoria: piloto.Categoria || piloto.CATEGORIA || '',
                totalConPenalizacion: totalConPenalizacion
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);
    
    const clasificacion = {};
    todosLosPilotos.forEach((piloto, index) => {
        clasificacion[piloto.nombre] = index + 1;
    });
    
    return clasificacion;
}

function calcularGanadorCategoria(categoria, totalPEs, clasificacionGeneral) {
    const pilotosCategoria = pilotosData
        .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
        .map(piloto => {
            let totalSegundos = 0;
            let tuvoDNF = false;
            
            for (let i = 1; i <= totalPEs; i++) {
                const columnaSS = `SS${i}`;
                const tiempo = piloto[columnaSS];
                
                if (!tiempo || tiempo === '') {
                    return null;
                }
                
                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = pilotosData
                        .filter(p => (p.Categoria || p.CATEGORIA) === categoria && p[columnaSS])
                        .map(p => {
                            const valorTiempo = p[columnaSS];
                            return {
                                tiempoSegundos: tiempoASegundos(valorTiempo),
                                tieneDNF: esDNF(valorTiempo)
                            };
                        })
                        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
                    
                    const peorTiempoTramo = obtenerPeorTiempo(pilotosEsteTramo);
                    totalSegundos += calcularTiempoDNF(peorTiempoTramo);
                    tuvoDNF = true;
                } else {
                    const segundos = tiempoASegundos(tiempo);
                    if (segundos >= 999999) {
                        return null;
                    }
                    totalSegundos += segundos;
                }
            }
            
            const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;
            
            const nombre = piloto.Nombre || piloto.NOMBRE || '';
            
            return {
                nombre: nombre,
                categoria: categoria,
                totalSegundos: totalSegundos,
                penalizacionSegundos: penalizacionSegundos,
                totalConPenalizacion: totalConPenalizacion,
                tiempoFormateado: segundosATiempo(totalConPenalizacion),
                tieneDNF: tuvoDNF,
                posicionGeneral: clasificacionGeneral[nombre] || '-'
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);
    
    return pilotosCategoria.length > 0 ? pilotosCategoria[0] : null;
}

function renderizarGanadoresFinales() {
    if (!verificarPEsCompletas()) {
        return;
    }
    
    const totalPEs = tramosData.length;
    const categorias = [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c).sort();
    
    const clasificacionGeneral = calcularClasificacionGeneral(totalPEs);
    
    let html = '<div class="ganadores-finales-container">';
    html += '<h2 class="ganadores-title">Ganadores por Categoría</h2>';
    html += '<div class="ganadores-grid">';
    
    categorias.forEach(categoria => {
        const ganador = calcularGanadorCategoria(categoria, totalPEs, clasificacionGeneral);
        
        if (ganador) {
            html += `
                <div class="ganador-card">
                    <div class="ganador-categoria">${categoria}</div>
                    <div class="ganador-nombre">${ganador.nombre}</div>
                    <div class="ganador-stats">
                        <div class="ganador-tiempo-total">
                            <span class="tiempo-label">Tiempo Total</span>
                            <span class="tiempo-valor">${ganador.tiempoFormateado}</span>
                        </div>
                        <div class="ganador-posicion">
                            <span class="tiempo-label">Pos. General</span>
                            <span class="tiempo-valor">P${ganador.posicionGeneral}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div></div>';
    
    document.getElementById('content').innerHTML += html;
}

function verClases(pe) {
    window.location.href = `pages/tramo.html?pe=${pe}`;
}

function verGeneral(pe) {
    window.location.href = `pages/tramoGeneral.html?pe=${pe}`;
}

function actualizarUltimaActualizacion() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent = 
        `Última actualización: ${timeStr}`;
}

cargarNombreRally();
cargarDatos();
setInterval(cargarDatos, 30000);
