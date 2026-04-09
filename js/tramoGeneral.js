const PILOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1122371230&single=true&output=csv';
const TRAMOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=0&single=true&output=csv';
const { analizarCSV } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;

let pilotosData = [];
let tramosData = [];
let peNumber = '';

function obtenerParametroURL(parametro) {
    const parametrosURL = new URLSearchParams(window.location.search);
    return parametrosURL.get(parametro);
}

function analizarPilotosCSV(csv) {
    return analizarCSV(csv, {
        filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE) && (fila.Categoria || fila.CATEGORIA))
    });
}

function analizarTramosCSV(csv) {
    return analizarCSV(csv, {
        filtrarFila: fila => Boolean(fila.PE && fila.PE !== '')
    });
}

function obtenerNombreTramo(tramoActual) {
    if (!tramoActual) return '';

    const desde = tramoActual.Desde || '';
    const hasta = tramoActual.Hasta || '';

    if (desde && hasta) {
        return `${desde} - ${hasta}`;
    }

    return tramoActual.Nombre || tramoActual.NOMBRE || '';
}

function obtenerPrioridadCategoria(categoria) {
    const categoriaNormalizada = (categoria || '').trim().toUpperCase();

    if (categoriaNormalizada === 'RC2' || categoriaNormalizada === 'RALLY2') {
        return 0;
    }

    if (categoriaNormalizada === 'RCMR') {
        return 1;
    }

    return 2;
}

function obtenerColorCategoriaPredeterminado(categoria) {
    const categoriaNormalizada = (categoria || '').trim().toUpperCase();

    if (categoriaNormalizada === 'RC2' || categoriaNormalizada === 'RALLY2') {
        return 1;
    }

    if (categoriaNormalizada === 'RCMR') {
        return 2;
    }

    if (categoriaNormalizada === 'RC4') {
        return 3;
    }

    if (categoriaNormalizada === 'RC3' || categoriaNormalizada === 'JUNIOR') {
        return 4;
    }

    if (categoriaNormalizada === 'RC5') {
        return 5;
    }

    return null;
}

function ordenarCategorias(categorias) {
    return [...categorias].sort((a, b) => {
        const prioridadA = obtenerPrioridadCategoria(a);
        const prioridadB = obtenerPrioridadCategoria(b);

        if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
        }

        return a.localeCompare(b, 'es');
    });
}

function crearMapaColoresCategorias(categorias) {
    const coloresDisponibles = [6, 7, 8];
    let indiceColorDisponible = 0;
    const mapaColores = {};

    categorias.forEach(categoria => {
        const colorPredeterminado = obtenerColorCategoriaPredeterminado(categoria);

        if (colorPredeterminado !== null) {
            mapaColores[categoria] = colorPredeterminado;
            return;
        }

        mapaColores[categoria] = coloresDisponibles[indiceColorDisponible % coloresDisponibles.length];
        indiceColorDisponible++;
    });

    return mapaColores;
}

function formatearDiferencia(segundosDiferencia) {
    if (segundosDiferencia === 0) return '-';
    return '+' + segundosATiempo(segundosDiferencia, 2);
}

function calcularVelocidadPromedio(tiempoSegundos, distanciaKm) {
    if (tiempoSegundos >= 999999 || !distanciaKm || distanciaKm === '') return '-';

    const distancia = parseFloat(distanciaKm);
    if (isNaN(distancia) || distancia <= 0) return '-';

    const tiempoHoras = tiempoSegundos / 3600;
    const velocidad = distancia / tiempoHoras;

    return velocidad.toFixed(0);
}

function calcularVelocidadPromedioTotal(tiempoSegundos, peNumero) {
    if (tiempoSegundos >= 999999) return '-';

    let distanciaTotal = 0;
    for (let i = 1; i <= peNumero; i++) {
        const tramo = tramosData.find(t => t.PE === i.toString());
        if (tramo && tramo.KMS) {
            const distancia = parseFloat(tramo.KMS);
            if (!isNaN(distancia) && distancia > 0) {
                distanciaTotal += distancia;
            }
        }
    }

    if (distanciaTotal === 0) return '-';

    const tiempoHoras = tiempoSegundos / 3600;
    const velocidad = distanciaTotal / tiempoHoras;

    return velocidad.toFixed(0);
}

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;

        const [pilotosResponse, tramosResponse] = await Promise.all([
            fetch(PILOTOS_URL + cacheBuster),
            fetch(TRAMOS_URL + cacheBuster)
        ]);

        const pilotosText = await pilotosResponse.text();
        const tramosText = await tramosResponse.text();

        pilotosData = analizarPilotosCSV(pilotosText);
        tramosData = analizarTramosCSV(tramosText);

        renderizarResultados();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

function mostrarInfoTramo() {
    peNumber = obtenerParametroURL('pe');
    const tramoActual = tramosData.find(t => t.PE === peNumber);
    const tituloElement = document.getElementById('title');

    if (tramoActual) {
        const nombreTramo = obtenerNombreTramo(tramoActual);

        if (tituloElement) {
            tituloElement.innerHTML = `
                <span class="titulo-tramo-pe">PE ${peNumber}</span>
                <span class="titulo-tramo-texto">| ${nombreTramo}</span>
            `;
        }
    } else if (tituloElement) {
        tituloElement.textContent = `CLASIFICACIÓN GENERAL - PE ${peNumber}`;
    }
}

function renderizarResultados() {
    peNumber = obtenerParametroURL('pe');
    const peNumero = parseInt(peNumber);

    mostrarInfoTramo();

    if (pilotosData.length === 0) {
        document.getElementById('content').innerHTML =
            '<div class="error">No se encontraron datos de pilotos.</div>';
        return;
    }

    const ssColumn = `SS${peNumber}`;
    const tramoActual = tramosData.find(t => t.PE === peNumber);
    const distanciaTramo = tramoActual ? tramoActual.KMS : null;

    const categorias = ordenarCategorias(
        [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c)
    );
    const categoriasColor = crearMapaColoresCategorias(categorias);

    const pilotosPE = pilotosData
        .filter(p => p[ssColumn])
        .map(p => {
            const valorTiempo = p[ssColumn];
            const tieneDNF = esDNF(valorTiempo);
            const categoria = p.Categoria || p.CATEGORIA || '';

            return {
                nombre: p.Nombre || p.NOMBRE || '',
                categoria: categoria,
                colorIndex: categoriasColor[categoria] || 1,
                tiempo: valorTiempo,
                tiempoSegundos: tiempoASegundos(valorTiempo),
                tieneDNF: tieneDNF
            };
        })
        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const peorTiempoPE = obtenerPeorTiempo(pilotosPE);

    pilotosPE.forEach(piloto => {
        if (piloto.tieneDNF) {
            piloto.tiempoSegundos = calcularTiempoDNF(peorTiempoPE);
            piloto.tiempo = segundosATiempo(piloto.tiempoSegundos, 2);
        }
    });

    pilotosPE.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const mejorTiempo = pilotosPE.length > 0 ? pilotosPE[0].tiempoSegundos : 0;

    let htmlPE = '<div class="section-title">Clasificación P.E.</div>';
    htmlPE += `
        <table>
            <thead>
                <tr>
                    <th class="col-pos">Pos</th>
                    <th>Piloto</th>
                    <th>Tiempo</th>
                    <th>Dif. 1°</th>
                    <th>PROM</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosPE.forEach((piloto, index) => {
        const diferencia = piloto.tiempoSegundos - mejorTiempo;
        const claseFilaDNF = piloto.tieneDNF ? 'fila-dnf' : '';
        const claseColor = `category-bg-${piloto.colorIndex}`;
        const rowClass = index === 0 ? 'pos-1' : (claseFilaDNF ? claseFilaDNF : claseColor);
        const velocidadProm = calcularVelocidadPromedio(piloto.tiempoSegundos, distanciaTramo);
        const tiempoMostrar = piloto.tieneDNF ? 'DNF' : piloto.tiempo;

        htmlPE += `
            <tr class="${rowClass}">
                <td class="col-pos"><strong>${index + 1}</strong></td>
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
    `;

    const pilotosGeneral = pilotosData
        .map(p => {
            let totalSegundos = 0;
            let tuvoDNF = false;

            for (let i = 1; i <= peNumero; i++) {
                const columnaSS = `SS${i}`;
                const tiempo = p[columnaSS];

                if (!tiempo || tiempo === '') {
                    return null;
                }

                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = pilotosData
                        .filter(piloto => piloto[columnaSS])
                        .map(piloto => {
                            const valorTiempo = piloto[columnaSS];
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

            const penalizacion = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
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
                    <th class="col-pos">Pos</th>
                    <th>Piloto</th>
                    <th>Clase</th>
                    <th>Tiempo</th>
                    <th>Penal.</th>
                    <th>T. Total</th>
                    <th>Dif. 1°</th>
                    <th>Dif. Ant.</th>
                    <th>PROM</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosGeneral.forEach((piloto, index) => {
        const dif1 = piloto.totalConPenalizacion - mejorTotal;
        const difAnt = index > 0 ? piloto.totalConPenalizacion - pilotosGeneral[index - 1].totalConPenalizacion : 0;
        const rowClass = index === 0 ? 'pos-1' : (piloto.tieneDNF ? 'fila-dnf' : '');
        const tiempoFormateado = segundosATiempo(piloto.totalSegundos, 2);
        const penalizFormateada = piloto.penalizacionSegundos > 0 ? segundosATiempo(piloto.penalizacionSegundos, 2) : '-';
        const totalFormateado = segundosATiempo(piloto.totalConPenalizacion, 2);
        const penalizClass = piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : '';
        const velocidadPromTotal = calcularVelocidadPromedioTotal(piloto.totalConPenalizacion, peNumero);

        htmlGeneral += `
            <tr class="${rowClass}">
                <td class="col-pos"><strong>${index + 1}</strong></td>
                <td>${piloto.nombre}</td>
                <td>${piloto.categoria}</td>
                <td>${tiempoFormateado}</td>
                <td class="${penalizClass}">${penalizFormateada}</td>
                <td>${totalFormateado}</td>
                <td>${formatearDiferencia(dif1)}</td>
                <td>${formatearDiferencia(difAnt)}</td>
                <td>${velocidadPromTotal}</td>
            </tr>
        `;
    });

    htmlGeneral += `
            </tbody>
        </table>
    `;

    const html = `
        <div class="tables-container">
            <div class="table-column table-pe">${htmlPE}</div>
            <div class="table-column table-general">${htmlGeneral}</div>
        </div>
    `;

    document.getElementById('content').innerHTML = html;
}

function actualizarUltimaActualizacion() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent =
        `Última actualización: ${timeStr}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);
