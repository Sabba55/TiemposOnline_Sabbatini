const URL_PILOTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1122371230&single=true&output=csv';
const URL_TRAMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=0&single=true&output=csv';

let datosPilotos = [];
let datosTramos = [];
let numeroPE = '';

function obtenerParametroURL(parametro) {
    const parametrosURL = new URLSearchParams(window.location.search);
    return parametrosURL.get(parametro);
}

function analizarCSV(csv) {
    const lineas = csv.trim().split('\n');
    const encabezados = lineas[0].split(',').map(e => e.trim());
    const datos = [];
    
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;
        
        const valores = lineas[i].split(',').map(v => v.trim());
        const objeto = {};
        encabezados.forEach((encabezado, indice) => {
            objeto[encabezado] = valores[indice] || '';
        });
        
        const nombre = objeto.Nombre || objeto.NOMBRE || '';
        const categoria = objeto.Categoria || objeto.CATEGORIA || '';
        
        if (nombre && categoria) {
            datos.push(objeto);
        }
    }
    
    return datos;
}

function analizarTramosCSV(csv) {
    const lineas = csv.trim().split('\n');
    const encabezados = lineas[0].split(',').map(e => e.trim());
    const datos = [];
    
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;
        
        const valores = lineas[i].split(',').map(v => v.trim());
        const objeto = {};
        encabezados.forEach((encabezado, indice) => {
            objeto[encabezado] = valores[indice] || '';
        });
        
        if (objeto.PE && objeto.PE !== '') {
            datos.push(objeto);
        }
    }
    
    return datos;
}

function corregirFormatoTiempo(cadenaHora) {
    if (!cadenaHora || cadenaHora === '') return '';
    
    // Eliminar espacios
    let tiempo = cadenaHora.trim();
    
    // Contar cuántos separadores hay
    const separadores = (tiempo.match(/[:.,]/g) || []).length;
    
    if (separadores === 2) {
        // Formato: XX:XX:XXX o XX.XX.XXX o XX,XX,XXX o variaciones
        // Dividir y reconstruir en formato estándar MM:SS.mmm
        const partes = tiempo.split(/[:.,]/);
        if (partes.length === 3) {
            tiempo = `${partes[0]}:${partes[1]}.${partes[2]}`;
        }
    } else if (separadores === 1) {
        // Ya está en formato correcto o solo necesita cambiar el separador de decimales
        tiempo = tiempo.replace(/[,]/, '.');
    }
    
    return tiempo;
}

function esDNF(cadenaHora) {
    if (!cadenaHora) return false;
    const valorLimpio = cadenaHora.trim().toUpperCase();
    return valorLimpio === 'DNF' || valorLimpio === 'D.N.F' || valorLimpio === 'D.N.F.';
}

function tiempoASegundos(cadenaHora) {
    if (!cadenaHora || cadenaHora === '') return 999999;
    
    // Verificar si es DNF
    if (esDNF(cadenaHora)) return 999999;
    
    // Corregir el formato antes de procesar
    cadenaHora = corregirFormatoTiempo(cadenaHora);
    
    const partes = cadenaHora.split(':');
    if (partes.length === 2) {
        return parseInt(partes[0]) * 60 + parseFloat(partes[1]);
    } else if (partes.length === 3) {
        return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseFloat(partes[2]);
    }
    return 999999;
}

function segundosATiempo(segundos) {
    if (segundos >= 999999) return '-';
    
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = (segundos % 60).toFixed(2);
    
    if (horas > 0) {
        return `${horas}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(5, '0')}`;
    }
    return `${minutos}:${String(segs).padStart(5, '0')}`;
}

function formatearDiferencia(segundosDif) {
    if (segundosDif === 0) return '-';
    return '+' + segundosATiempo(segundosDif);
}

function calcularVelocidadPromedio(segundosTiempo, distanciaKm) {
    if (segundosTiempo >= 999999 || !distanciaKm || distanciaKm === '') return '-';
    
    const distancia = parseFloat(distanciaKm);
    if (isNaN(distancia) || distancia <= 0) return '-';
    
    const tiempoHoras = segundosTiempo / 3600;
    const velocidad = distancia / tiempoHoras;
    
    return velocidad.toFixed(0);
}

async function cargarDatos() {
    try {
        const [respuestaPilotos, respuestaTramos] = await Promise.all([
            fetch(URL_PILOTOS),
            fetch(URL_TRAMOS)
        ]);
        
        const textoPilotos = await respuestaPilotos.text();
        const textoTramos = await respuestaTramos.text();
        
        datosPilotos = analizarCSV(textoPilotos);
        datosTramos = analizarTramosCSV(textoTramos);
        
        renderizarResultados();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

function calcularTotalAcumulado(piloto, hastaPE) {
    let totalSegundos = 0;
    
    // Validar que tenga TODOS los tiempos consecutivos desde SS1 hasta hastaPE
    for (let i = 1; i <= hastaPE; i++) {
        const columnaSS = `SS${i}`;
        const tiempo = piloto[columnaSS];
        
        // Si falta algún tiempo o está vacío, retornar 999999 (no aparecerá en general)
        if (!tiempo || tiempo === '') {
            return 999999;
        }
        
        const segundos = tiempoASegundos(tiempo);
        
        // Si el tiempo no es válido, retornar 999999
        if (segundos >= 999999) {
            return 999999;
        }
        
        totalSegundos += segundos;
    }
    
    return totalSegundos;
}

function obtenerPenalizacion(piloto) {
    const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
    return penalizacion < 999999 ? penalizacion : 0;
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
    // Peor tiempo + 1 minuto (60 segundos)
    return peorTiempoCategoria + 60;
}

function mostrarInfoTramo() {
    numeroPE = obtenerParametroURL('pe');
    const tramoActual = datosTramos.find(t => t.PE === numeroPE);
    
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
        
        const divInfoTramo = document.getElementById('tramoInfo');
        divInfoTramo.innerHTML = `
            <div>${nombreTramo}</div>
            ${detallesHTML ? `<div class="tramo-details">${detallesHTML}</div>` : ''}
        `;
        divInfoTramo.style.display = 'block';
    }
}

function renderizarResultados() {
    numeroPE = obtenerParametroURL('pe');
    const numeroPEInt = parseInt(numeroPE);
    document.getElementById('title').textContent = `RESULTADOS - PE ${numeroPE}`;
    
    mostrarInfoTramo();

    if (datosPilotos.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">⚠ No se encontraron datos de pilotos.</div>';
        return;
    }

    const columnaSSActual = `SS${numeroPE}`;
    
    // Obtener la distancia del tramo actual
    const tramoActual = datosTramos.find(t => t.PE === numeroPE);
    const distanciaTramo = tramoActual ? tramoActual.KMS : null;
    
    const categorias = [...new Set(datosPilotos.map(p => p.Categoria || p.CATEGORIA))].filter(c => c).sort();

    let htmlPE = '<div class="section-title">Clasificación P.E.</div>';
    let htmlGeneral = '<div class="section-title">Clasificación General</div>';

    categorias.forEach(categoria => {
        const pilotosCategoria = datosPilotos
            .filter(p => (p.Categoria || p.CATEGORIA) === categoria && p[columnaSSActual])
            .map(p => {
                const totalAcumulado = calcularTotalAcumulado(p, numeroPEInt);
                const valorTiempo = p[columnaSSActual];
                const tieneDNF = esDNF(valorTiempo);
                
                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    categoria: categoria,
                    tiempo: valorTiempo,
                    tiempoSegundos: tiempoASegundos(valorTiempo),
                    totalSegundos: totalAcumulado,
                    tieneDNF: tieneDNF
                };
            })
            .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

        if (pilotosCategoria.length === 0) return;

        // Obtener el peor tiempo de la categoría (excluyendo DNF)
        const peorTiempoCategoria = obtenerPeorTiempoCategoria(pilotosCategoria);
        
        // Procesar pilotos con DNF
        pilotosCategoria.forEach(piloto => {
            if (piloto.tieneDNF) {
                piloto.tiempoSegundos = calcularTiempoDNF(peorTiempoCategoria);
                piloto.tiempo = segundosATiempo(piloto.tiempoSegundos);
            }
        });
        
        // Reordenar después de aplicar tiempos DNF
        pilotosCategoria.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

        const mejorTiempo = pilotosCategoria[0].tiempoSegundos;

        htmlPE += `
            <div class="category-section">
                <div class="category-title">${categoria}</div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Piloto</th>
                                <th>Tiempo</th>
                                <th>Diferencia</th>
                                <th>PROM</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        pilotosCategoria.forEach((piloto, indice) => {
            const diferencia = piloto.tiempoSegundos - mejorTiempo;
            const claseFilaDNF = piloto.tieneDNF ? 'fila-dnf' : '';
            const claseFila = indice === 0 ? 'pos-1' : claseFilaDNF;
            const velocidadProm = calcularVelocidadPromedio(piloto.tiempoSegundos, distanciaTramo);
            const tiempoMostrar = piloto.tieneDNF ? 'DNF' : piloto.tiempo;

            htmlPE += `
                <tr class="${claseFila}">
                    <td><strong>${indice + 1}</strong></td>
                    <td>${piloto.nombre}</td>
                    <td>${tiempoMostrar}</td>
                    <td>${formatearDiferencia(diferencia)}</td>
                    <td>${velocidadProm}</td>
                </tr>
            `;
        });

        htmlPE += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    categorias.forEach(categoria => {
        const pilotosGeneralCategoria = datosPilotos
            .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
            .map(p => {
                let totalSegundos = 0;
                let tuvoDNF = false;
                
                // Sumar todos los tramos del PE1 hasta el PE actual
                for (let i = 1; i <= numeroPEInt; i++) {
                    const columnaSS = `SS${i}`;
                    const tiempo = p[columnaSS];
                    
                    if (!tiempo || tiempo === '') {
                        // Si no tiene tiempo en este tramo, no se puede calcular el total
                        return null;
                    }
                    
                    if (esDNF(tiempo)) {
                        // Calcular el peor tiempo de ESTE tramo específico
                        const pilotosEsteTramo = datosPilotos
                            .filter(piloto => (piloto.Categoria || piloto.CATEGORIA) === categoria && piloto[columnaSS])
                            .map(piloto => {
                                const valorTiempo = piloto[columnaSS];
                                return {
                                    tiempoSegundos: tiempoASegundos(valorTiempo),
                                    tieneDNF: esDNF(valorTiempo)
                                };
                            })
                            .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
                        
                        const peorTiempoTramo = obtenerPeorTiempoCategoria(pilotosEsteTramo);
                        
                        // Si tiene DNF, usar el tiempo calculado (peor tiempo de ESTE tramo + 60s)
                        totalSegundos += calcularTiempoDNF(peorTiempoTramo);
                        tuvoDNF = true;
                    } else {
                        // Tiempo normal
                        const segundos = tiempoASegundos(tiempo);
                        if (segundos >= 999999) {
                            return null;
                        }
                        totalSegundos += segundos;
                    }
                }
                
                const penalizacion = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
                const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
                const totalConPenalizacion = totalSegundos + penalizacionSegundos;
                
                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    categoria: categoria,
                    totalSegundos: totalSegundos,
                    penalizacionSegundos: penalizacionSegundos,
                    totalConPenalizacion: totalConPenalizacion,
                    tieneDNF: tuvoDNF
                };
            })
            .filter(p => p !== null) // Filtrar pilotos sin datos completos
            .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

        if (pilotosGeneralCategoria.length === 0) return;

        const mejorTotal = pilotosGeneralCategoria[0].totalConPenalizacion;

        htmlGeneral += `
            <div class="category-section">
                <div class="category-title">${categoria}</div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Piloto</th>
                                <th>Tiempo</th>
                                <th>Penaliz</th>
                                <th>T. Total</th>
                                <th>Dif. 1°</th>
                                <th>Dif. Ant.</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        pilotosGeneralCategoria.forEach((piloto, indice) => {
            const dif1 = piloto.totalConPenalizacion - mejorTotal;
            const difAnt = indice > 0 ? piloto.totalConPenalizacion - pilotosGeneralCategoria[indice - 1].totalConPenalizacion : 0;
            const claseFila = indice === 0 ? 'pos-1' : (piloto.tieneDNF ? 'fila-dnf' : '');
            
            // Mostrar tiempos SIEMPRE como números, incluso si tiene DNF
            const tiempoFormateado = segundosATiempo(piloto.totalSegundos);
            const penalizFormateada = piloto.penalizacionSegundos > 0 ? segundosATiempo(piloto.penalizacionSegundos) : '-';
            const totalFormateado = segundosATiempo(piloto.totalConPenalizacion);
            const clasePenaliz = piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : '';

            htmlGeneral += `
                <tr class="${claseFila}">
                    <td><strong>${indice + 1}</strong></td>
                    <td>${piloto.nombre}</td>
                    <td>${tiempoFormateado}</td>
                    <td class="${clasePenaliz}">${penalizFormateada}</td>
                    <td>${totalFormateado}</td>
                    <td>${formatearDiferencia(dif1)}</td>
                    <td>${formatearDiferencia(difAnt)}</td>
                </tr>
            `;
        });

        htmlGeneral += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    const html = `
        <div class="tables-container">
            <div class="table-column">${htmlPE}</div>
            <div class="table-column">${htmlGeneral}</div>
        </div>
    `;

    document.getElementById('content').innerHTML = html;
}

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    const horaTexto = ahora.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent = 
        `🔄 Última actualización: ${horaTexto}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);