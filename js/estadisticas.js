const URL_PILOTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1122371230&single=true&output=csv';
const URL_TRAMOS  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=0&single=true&output=csv';

const { analizarCSV: analizarCSVBase } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
const { obtenerRutaLogoMarca, obtenerMarcaVehiculo } = window.UtilidadesIconos;

let datosPilotos = [];
let datosTramos  = [];
let categoriaActiva = null;

// ── Parseo de CSVs ────────────────────────────────────────────────────────────
function analizarPilotosCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE) && (fila.Categoria || fila.CATEGORIA))
    });
}

function analizarTramosCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean(fila.PE && fila.PE !== '')
    });
}

// ── Helpers de participación ──────────────────────────────────────────────────

// Un piloto "participó" si tiene al menos un tiempo registrado (aunque sea DNF) en cualquier PE.
// Si no tiene ningún dato en ningún PE, se considera no participante y no debe contar en nada.
function pilotoParticipo(piloto) {
    const totalPEs = datosTramos.length;
    for (let i = 1; i <= totalPEs; i++) {
        const tiempo = piloto[`SS${i}`];
        if (tiempo && tiempo.trim() !== '') return true;
    }
    return false;
}

// Filtra los pilotos de una categoría excluyendo los no participantes
function pilotosDeCat(categoria) {
    return datosPilotos.filter(p =>
        (p.Categoria || p.CATEGORIA) === categoria && pilotoParticipo(p)
    );
}

// ── Helpers de categorías ─────────────────────────────────────────────────────
function obtenerPrioridadCategoria(categoria) {
    const cat = (categoria || '').trim().toUpperCase();
    if (cat === 'RC2' || cat === 'RALLY2') return 0;
    if (cat === 'RCMR') return 1;
    return 2;
}

function ordenarCategorias(categorias) {
    return [...categorias].sort((a, b) => {
        const diff = obtenerPrioridadCategoria(a) - obtenerPrioridadCategoria(b);
        return diff !== 0 ? diff : a.localeCompare(b, 'es');
    });
}

// Devuelve solo las categorias que tienen al menos un tiempo cargado en cualquier PE
function obtenerCategoriasConTiempos() {
    const totalPEs = datosTramos.length;
    const categoriasConTiempos = new Set();

    datosPilotos.forEach(piloto => {
        const categoria = piloto.Categoria || piloto.CATEGORIA;
        if (!categoria) return;

        for (let i = 1; i <= totalPEs; i++) {
            const tiempo = piloto[`SS${i}`];
            if (tiempo && tiempo.trim() !== '') {
                categoriasConTiempos.add(categoria);
                break;
            }
        }
    });

    return ordenarCategorias([...categoriasConTiempos]);
}

// ── Cálculos de estadísticas ──────────────────────────────────────────────────

function calcularTotalInscriptos(categoria) {
    return datosPilotos.filter(p => (p.Categoria || p.CATEGORIA) === categoria).length;
}

function calcularInscriptos(categoria) {
    return pilotosDeCat(categoria).length;
}

function calcularDNFs(categoria) {
    const totalPEs = datosTramos.length;
    let totalDNF = 0;

    pilotosDeCat(categoria)
        .forEach(piloto => {
            for (let i = 1; i <= totalPEs; i++) {
                const tiempo = piloto[`SS${i}`];
                if (tiempo && esDNF(tiempo)) {
                    totalDNF++;
                    break; // ya suma 1, no seguir contando sus demás tramos
                }
            }
        });

    return totalDNF;
}

// calcularMarcas está comentada por ahora
// function calcularMarcas(categoria) { ... }

function calcularPorcentajeSinDNF(categoria) {
    const totalPEs = datosTramos.length;
    const pilotos = pilotosDeCat(categoria);

    if (pilotos.length === 0) return null;

    let sinDNF = 0;
    pilotos.forEach(piloto => {
        let tuvoDNF = false;
        for (let i = 1; i <= totalPEs; i++) {
            const tiempo = piloto[`SS${i}`];
            if (tiempo && esDNF(tiempo)) { tuvoDNF = true; break; }
        }
        if (!tuvoDNF) sinDNF++;
    });

    return {
        porcentaje: Math.round((sinDNF / pilotos.length) * 100),
        sinDNF,
        total: pilotos.length
    };
}

// Devuelve array con { pe, ganador, tiempo, velocidad } por cada PE disputado
function calcularGanadoresPorTramo(categoria) {
    const resultado = [];

    datosTramos.forEach(tramo => {
        const pe = tramo.PE;
        const columna = `SS${pe}`;
        const distancia = tramo.KMS ? parseFloat(tramo.KMS) : null;

        const pilotos = pilotosDeCat(categoria)
            .filter(p => p[columna] && p[columna].trim() !== '')
            .map(p => {
                const valorTiempo = p[columna];
                const segundos = tiempoASegundos(valorTiempo);
                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    tiempoSegundos: segundos,
                    esDNF: esDNF(valorTiempo)
                };
            })
            .filter(p => !p.esDNF && p.tiempoSegundos < 999999)
            .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

        if (pilotos.length === 0) return;

        const ganador = pilotos[0];
        let velocidad = '-';
        if (distancia && !isNaN(distancia) && distancia > 0) {
            velocidad = (distancia / (ganador.tiempoSegundos / 3600)).toFixed(0);
        }

        resultado.push({
            pe,
            nombre: tramo.Desde && tramo.Hasta ? `${tramo.Desde} - ${tramo.Hasta}` : `PE ${pe}`,
            ganador: ganador.nombre,
            tiempo: segundosATiempo(ganador.tiempoSegundos, 2),
            velocidad
        });
    });

    return resultado;
}

// Cuenta cuántas veces ganó cada piloto un PE en esa categoría
function calcularMayorGanador(ganadoresPorTramo) {
    const conteo = {};

    ganadoresPorTramo.forEach(({ ganador }) => {
        conteo[ganador] = (conteo[ganador] || 0) + 1;
    });

    const ordenados = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1]);

    if (ordenados.length === 0) return null;

    return { nombre: ordenados[0][0], victorias: ordenados[0][1] };
}

// Velocidad promedio más alta registrada en un solo tramo para cualquier piloto de la categoría
function calcularVelocidadMaxima(categoria) {
    let maxVelocidad = 0;
    let pilotoMax = '';
    let peMax = '';
    let kmsMax = null;
    let tiempoMax = '';

    datosTramos.forEach(tramo => {
        const pe = tramo.PE;
        const columna = `SS${pe}`;
        const distancia = tramo.KMS ? parseFloat(tramo.KMS) : null;
        if (!distancia || isNaN(distancia) || distancia <= 0) return;

        pilotosDeCat(categoria)
            .filter(p => p[columna] && !esDNF(p[columna]))
            .forEach(piloto => {
                const segundos = tiempoASegundos(piloto[columna]);
                if (segundos >= 999999) return;

                const velocidad = distancia / (segundos / 3600);
                if (velocidad > maxVelocidad) {
                    maxVelocidad = velocidad;
                    pilotoMax = piloto.Nombre || piloto.NOMBRE || '';
                    peMax = `PE ${pe}`;
                    kmsMax = tramo.KMS;
                    tiempoMax = segundosATiempo(segundos, 2);
                }
            });
    });

    if (maxVelocidad === 0) return null;

    return {
        velocidad: maxVelocidad.toFixed(0),
        piloto: pilotoMax,
        pe: peMax,
        kms: kmsMax,
        tiempo: tiempoMax
    };
}

// Tramo más disputado: PE con menor diferencia entre el 1° y el 2° (tiempos de ese PE, sin acumular, sin DNF)
function calcularTramoMasDisputado(categoria) {
    let menorDif = Infinity;
    let resultado = null;

    datosTramos.forEach(tramo => {
        const pe = tramo.PE;
        const columna = `SS${pe}`;

        const tiempos = pilotosDeCat(categoria)
            .filter(p => p[columna] && p[columna].trim() !== '' && !esDNF(p[columna]))
            .map(p => tiempoASegundos(p[columna]))
            .filter(s => s < 999999)
            .sort((a, b) => a - b);

        if (tiempos.length < 2) return;

        const dif = tiempos[1] - tiempos[0];
        if (dif < menorDif) {
            menorDif = dif;
            resultado = {
                pe,
                kms: tramo.KMS || null,
                nombre: tramo.Desde && tramo.Hasta ? `${tramo.Desde} - ${tramo.Hasta}` : `PE ${pe}`,
                difSegundos: dif,
                tiempo1: segundosATiempo(tiempos[0], 3),
                tiempo2: segundosATiempo(tiempos[1], 3)
            };
        }
    });

    return resultado;
}
function calcularPilotoMasConsistente(categoria) {
    // Agrupar tramos por su nombre "Desde - Hasta"
    const gruposPorNombre = {};
    datosTramos.forEach(tramo => {
        const desde = (tramo.Desde || '').trim();
        const hasta  = (tramo.Hasta  || '').trim();
        if (!desde || !hasta) return;
        const clave = `${desde} - ${hasta}`;
        if (!gruposPorNombre[clave]) gruposPorNombre[clave] = [];
        gruposPorNombre[clave].push(tramo.PE);
    });

    // Solo interesan los nombres que aparecen 2 o más veces
    const nombresRepetidos = Object.entries(gruposPorNombre)
        .filter(([, pes]) => pes.length >= 2);

    if (nombresRepetidos.length === 0) return null;

    const candidatos = [];

    pilotosDeCat(categoria)
        .forEach(piloto => {
            let tiemposTotales = [];

            nombresRepetidos.forEach(([, pes]) => {
                const tiemposDelGrupo = [];
                pes.forEach(pe => {
                    const tiempo = piloto[`SS${pe}`];
                    if (!tiempo || tiempo.trim() === '' || esDNF(tiempo)) return;
                    const seg = tiempoASegundos(tiempo);
                    if (seg < 999999) tiemposDelGrupo.push(seg);
                });
                // Solo usar este grupo si el piloto completó al menos 2 instancias
                if (tiemposDelGrupo.length >= 2) {
                    tiemposTotales = tiemposTotales.concat(tiemposDelGrupo);
                }
            });

            if (tiemposTotales.length < 2) return;

            const promedio = tiemposTotales.reduce((a, b) => a + b, 0) / tiemposTotales.length;
            const varianza = tiemposTotales.reduce((sum, t) => sum + Math.pow(t - promedio, 2), 0) / tiemposTotales.length;
            const desvio = Math.sqrt(varianza);

            candidatos.push({
                nombre: piloto.Nombre || piloto.NOMBRE || '',
                desvio,
                tramosCompletados: tiemposTotales.length
            });
        });

    if (candidatos.length === 0) return null;

    candidatos.sort((a, b) => a.desvio - b.desvio);
    const mejor = candidatos[0];

    return {
        nombre: mejor.nombre,
        desvio: mejor.desvio.toFixed(1),
        tramosCompletados: mejor.tramosCompletados
    };
}

// Remontada por TIEMPO: piloto que más tiempo recortó al líder entre su PEOR diferencia acumulada y el resultado final
function calcularRemontadaPorTiempo(categoria) {
    const totalPEs = datosTramos.length;

    // Buscar el último PE con tiempos cargados para esta categoría
    let ultimoPE = 0;
    for (let i = totalPEs; i >= 1; i--) {
        const columna = `SS${i}`;
        const hayTiempos = pilotosDeCat(categoria).some(
            p => p[columna] && p[columna].trim() !== ''
        );
        if (hayTiempos) { ultimoPE = i; break; }
    }

    if (ultimoPE < 2) return null;

    // Calcula { nombre -> tiempoAcumulado } hasta un PE dado
    function tiemposAcumuladosPorPE(hastaPE) {
        const mapa = {};
        pilotosDeCat(categoria).forEach(piloto => {
            let total = 0;
            for (let i = 1; i <= hastaPE; i++) {
                const col = `SS${i}`;
                const t = piloto[col];
                if (!t || t.trim() === '') return;
                if (esDNF(t)) {
                    const grupo = pilotosDeCat(categoria)
                        .filter(p => p[col])
                        .map(p => ({ tiempoSegundos: tiempoASegundos(p[col]), tieneDNF: esDNF(p[col]) }));
                    total += calcularTiempoDNF(obtenerPeorTiempo(grupo));
                } else {
                    const seg = tiempoASegundos(t);
                    if (seg >= 999999) return;
                    total += seg;
                }
            }
            const pen = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            mapa[piloto.Nombre || piloto.NOMBRE || ''] = total + (pen < 999999 ? pen : 0);
        });
        return mapa;
    }

    // Construir mapa de tiempos acumulados en cada PE
    const tiemposPorPE = [];
    for (let pe = 1; pe <= ultimoPE; pe++) {
        tiemposPorPE.push(tiemposAcumuladosPorPE(pe));
    }

    const tiemposFinal     = tiemposPorPE[ultimoPE - 1];
    const tiempoLiderFinal = Math.min(...Object.values(tiemposFinal));

    let mejorRemontada = null;
    let mejorRecorte   = -Infinity;

    Object.entries(tiemposFinal).forEach(([nombre, tiempoFinal]) => {
        const difFinal = tiempoFinal - tiempoLiderFinal;

        // Buscar el PE donde tuvo la MAYOR diferencia al líder (peor momento)
        let peorDif = -Infinity;
        let peorPE  = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const mapa = tiemposPorPE[pe - 1];
            const propio = mapa[nombre];
            if (propio === undefined) continue;
            const lider = Math.min(...Object.values(mapa));
            const dif   = propio - lider;
            if (dif > peorDif) { peorDif = dif; peorPE = pe; }
        }

        if (peorPE === null) return;

        const recorte = peorDif - difFinal;
        if (recorte > mejorRecorte) {
            mejorRecorte = recorte;
            mejorRemontada = { nombre, peorDifSegundos: peorDif, difFinalSegundos: difFinal, recorteSegundos: recorte, desdePE: peorPE };
        }
    });

    return mejorRemontada && mejorRemontada.recorteSegundos > 0 ? mejorRemontada : null;
}

// Remontada por POSICIÓN: piloto que más posiciones ganó desde su PEOR posición acumulada al resultado final
function calcularRemontadaPorPosicion(categoria) {
    const totalPEs = datosTramos.length;

    let ultimoPE = 0;
    for (let i = totalPEs; i >= 1; i--) {
        const columna = `SS${i}`;
        const hayTiempos = pilotosDeCat(categoria).some(
            p => p[columna] && p[columna].trim() !== ''
        );
        if (hayTiempos) { ultimoPE = i; break; }
    }

    if (ultimoPE < 2) return null;

    // Posición acumulada de cada piloto en TODOS los PEs
    const posicionesPorPE = [];
    for (let pe = 1; pe <= ultimoPE; pe++) {
        posicionesPorPE.push(calcularPosicionesAcumuladas(categoria, pe));
    }

    const posicionesFinal = posicionesPorPE[ultimoPE - 1];

    let mejorRemontada = null;
    let mejorGanancia  = -Infinity;

    Object.keys(posicionesFinal).forEach(nombre => {
        const posFin = posicionesFinal[nombre];

        // Buscar la peor posición (número más alto) en PEs anteriores al último
        let peorPos = -Infinity;
        let peorPE  = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const pos = posicionesPorPE[pe - 1][nombre];
            if (!pos) continue;
            if (pos > peorPos) { peorPos = pos; peorPE = pe; }
        }

        if (peorPE === null || peorPos <= posFin) return;

        const ganancia = peorPos - posFin;
        if (ganancia > mejorGanancia) {
            mejorGanancia = ganancia;
            mejorRemontada = { nombre, posInicio: peorPos, posFin, ganancia, desdePE: peorPE };
        }
    });

    return mejorRemontada;
}

// Posiciones solo en un PE específico (sin acumular)
function calcularPosicionesPE(categoria, numeroPE) {
    const columna = `SS${numeroPE}`;

    const pilotos = pilotosDeCat(categoria)
        .filter(p => p[columna] && p[columna].trim() !== '')
        .map(p => {
            const valorTiempo = p[columna];
            const tieneDNF = esDNF(valorTiempo);
            let segundos = tiempoASegundos(valorTiempo);

            return {
                nombre: p.Nombre || p.NOMBRE || '',
                tiempoSegundos: segundos,
                tieneDNF
            };
        });

    const peorTiempo = obtenerPeorTiempo(pilotos);
    pilotos.forEach(p => {
        if (p.tieneDNF) p.tiempoSegundos = calcularTiempoDNF(peorTiempo);
    });
    pilotos.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const posiciones = {};
    pilotos.forEach((p, i) => { posiciones[p.nombre] = i + 1; });
    return posiciones;
}

// Posiciones acumuladas hasta un PE determinado
function calcularPosicionesAcumuladas(categoria, hastaPE) {
    const pilotos = pilotosDeCat(categoria)
        .map(piloto => {
            let totalSegundos = 0;

            for (let i = 1; i <= hastaPE; i++) {
                const columna = `SS${i}`;
                const tiempo = piloto[columna];
                if (!tiempo || tiempo.trim() === '') return null;

                if (esDNF(tiempo)) {
                    const pilotosTramo = pilotosDeCat(categoria)
                        .filter(p => p[columna])
                        .map(p => ({ tiempoSegundos: tiempoASegundos(p[columna]), tieneDNF: esDNF(p[columna]) }));
                    const peor = obtenerPeorTiempo(pilotosTramo);
                    totalSegundos += calcularTiempoDNF(peor);
                } else {
                    const seg = tiempoASegundos(tiempo);
                    if (seg >= 999999) return null;
                    totalSegundos += seg;
                }
            }

            const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            const penSeg = penalizacion < 999999 ? penalizacion : 0;

            return {
                nombre: piloto.Nombre || piloto.NOMBRE || '',
                total: totalSegundos + penSeg
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.total - b.total);

    const posiciones = {};
    pilotos.forEach((p, i) => { posiciones[p.nombre] = i + 1; });
    return posiciones;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderizarBotonesCategorias(categorias) {
    const nav = document.getElementById('categoriasNav');
    if (!nav) return;

    nav.innerHTML = categorias
        .map(cat => {
            const esActiva = cat === categoriaActiva;
            return `<button
                class="btn-categoria${esActiva ? ' activo' : ''}"
                onclick="seleccionarCategoria('${cat}')"
            >${cat}</button>`;
        })
        .join('');
}

function seleccionarCategoria(categoria) {
    categoriaActiva = categoria;

    // Actualizar estado visual de botones
    document.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.classList.toggle('activo', btn.textContent === categoria);
    });

    renderizarEstadisticasCategoria(categoria);
}

function renderizarEstadisticasCategoria(categoria) {
    const contenedor = document.getElementById('content');

    // ── Datos ──
    const totalInscriptos  = calcularTotalInscriptos(categoria);
    const largaron         = calcularInscriptos(categoria);
    const dnfs             = calcularDNFs(categoria);
    const porcentajeSinDNF = calcularPorcentajeSinDNF(categoria);
    // const marcas        = calcularMarcas(categoria); // comentado por ahora
    const ganadoresPE      = calcularGanadoresPorTramo(categoria);
    const mayorGanador     = calcularMayorGanador(ganadoresPE);
    const velocidadMax     = calcularVelocidadMaxima(categoria);
    const consistente      = calcularPilotoMasConsistente(categoria);
    const remontadaTiempo  = calcularRemontadaPorTiempo(categoria);
    const remontadaPos     = calcularRemontadaPorPosicion(categoria);
    const tramoDisputado   = calcularTramoMasDisputado(categoria);

    // ── HTML: tarjeta porcentaje sin DNF ──
    const colorPorcentaje = !porcentajeSinDNF      ? '#16a34a'
        : porcentajeSinDNF.porcentaje < 30          ? '#dc2626'   // rojo
        : porcentajeSinDNF.porcentaje <= 70          ? '#ea580c'   // naranja
        :                                              '#16a34a';  // verde
    const htmlPorcentaje = porcentajeSinDNF
        ? `
            <div class="tarjeta-resumen tarjeta-sin-dnf">
                <div class="seccion-titulo">Finalizaron sin DNF</div>
                <div class="tarjeta-valor" style="color: ${colorPorcentaje};">${porcentajeSinDNF.porcentaje}%</div>
                <div class="tarjeta-label">${porcentajeSinDNF.sinDNF} de ${porcentajeSinDNF.total} vehículos completaron todos los PE</div>
            </div>
        `
        : `
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Finalizaron sin DNF</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // Tarjeta Marcas: comentada por ahora
    // const htmlMarcas = ...

    const htmlResumen = `
        <div class="resumen-grid">
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Inscriptos</div>
                <div class="tarjeta-valor">${totalInscriptos}</div>
                <div class="tarjeta-label">anotados</div>
            </div>
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Largaron</div>
                <div class="tarjeta-valor">${largaron}</div>
                <div class="tarjeta-label">pilotos</div>
            </div>
            <div class="tarjeta-resumen tarjeta-dnf">
                <div class="seccion-titulo">Abandonos</div>
                <div class="tarjeta-valor">${dnfs}</div>
                <div class="tarjeta-label">abandonos registrados</div>
            </div>
            ${htmlPorcentaje}
        </div>
    `;

    // ── HTML: ganadores por tramo + mayor ganador ──
    let htmlFilasGanadores = '';
    if (ganadoresPE.length === 0) {
        htmlFilasGanadores = `<tr><td colspan="4" class="no-data">Sin tiempos registrados</td></tr>`;
    } else {
        ganadoresPE.forEach(({ pe, nombre, ganador, tiempo, velocidad }) => {
            htmlFilasGanadores += `
                <tr class="fila-ganador-pe">
                    <td class="col-pos"><strong>PE ${pe}</strong></td>
                    <td style="text-align:left; padding-left:14px;">${nombre}</td>
                    <td style="font-weight:700;">${ganador}</td>
                    <td class="col-tiempo">${tiempo}</td>
                </tr>
            `;
        });
    }

    const htmlMayorGanador = mayorGanador
        ? `
            <div class="tarjeta-mayor-ganador">
                <div class="mayor-ganador-label">Mayor ganador de tramos</div>
                <div class="mayor-ganador-nombre">${mayorGanador.nombre}</div>
                <div class="mayor-ganador-victorias">${mayorGanador.victorias}</div>
                <div class="mayor-ganador-victorias-label">victoria${mayorGanador.victorias !== 1 ? 's' : ''}</div>
            </div>
        `
        : '';

    const htmlGanadores = `
        <div class="ganadores-layout">
            <div>
                <div class="seccion-titulo">Ganadores por tramo</div>
                <table>
                    <thead>
                        <tr>
                            <th class="col-pos">PE</th>
                            <th>Tramo</th>
                            <th>Ganador</th>
                            <th class="col-tiempo">Tiempo</th>
                        </tr>
                    </thead>
                    <tbody>${htmlFilasGanadores}</tbody>
                </table>
            </div>
            ${htmlMayorGanador}
        </div>
    `;

    // ── HTML: velocidad máxima ──
    const htmlVelocidad = velocidadMax
        ? `
            <div class="tarjeta-velocidad">
                <div class="seccion-titulo">Velocidad promedio más alta</div>
                <div class="velocidad-piloto">${velocidadMax.piloto}</div>
                <div class="velocidad-numero-row">
                    <span class="velocidad-numero">${velocidadMax.velocidad}</span>
                    <span class="velocidad-unidad">km/h</span>
                </div>
                <div class="velocidad-detalle">
                    <span> Tiempo: ${velocidadMax.tiempo} | ${velocidadMax.pe}${velocidadMax.kms ? `  ${velocidadMax.kms} km` : ''}</span>
                </div>
            </div>
        `
        : `
            <div class="tarjeta-velocidad">
                <div class="seccion-titulo">Velocidad promedio más alta</div>
                <div class="no-data">Sin datos de distancia</div>
            </div>
        `;

    // ── HTML: piloto más consistente ──
    const htmlConsistente = consistente
        ? `
            <div class="tarjeta-consistencia">
                <div class="seccion-titulo">Piloto más consistente</div>
                <div class="consistencia-piloto">${consistente.nombre}</div>
                <div class="consistencia-desvio">±${consistente.desvio}s</div>
                <div class="consistencia-desvio-label">desvío estándar</div>
                <div class="consistencia-explicacion">
                    Menor variación de tiempos entre todos sus tramos.
                    Cuanto más bajo, más regular es el piloto.
                </div>
            </div>
        `
        : `
            <div class="tarjeta-consistencia">
                <div class="seccion-titulo">Piloto más consistente</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // ── HTML: mejor remontada por TIEMPO recortado al líder ──
    const fmtDif = seg => {
        const total = Math.abs(seg);
        const m  = Math.floor(total / 60);
        const s  = Math.floor(total % 60);
        const dec = Math.round((total % 1) * 10); // una décima
        const sStr = dec > 0 ? `${s}.${dec}s` : `${s}s`;
        return m > 0 ? `${m}m ${sStr}` : sStr;
    };
    const fmtDifFinal = seg => {
        if (seg <= 0) return '<span style="color:#16a34a; font-weight:800;">Líder</span>';
        return `+${fmtDif(seg)}`;
    };
    const htmlRemontadaTiempo = remontadaTiempo
        ? `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (tiempo)</div>
                <div class="remontada-piloto">${remontadaTiempo.nombre}</div>
                <span class="remontada-badge">−${fmtDif(remontadaTiempo.recorteSegundos)} al líder</span>
                <div class="remontada-posiciones">
                    <div class="remontada-pos-inicio">
                        <div class="remontada-pos-numero" style="font-size:20px;">+${fmtDif(remontadaTiempo.peorDifSegundos)}</div>
                        <div class="remontada-pos-label">tras PE ${remontadaTiempo.desdePE}</div>
                    </div>
                    <div class="remontada-flecha">→</div>
                    <div class="remontada-pos-fin">
                        <div class="remontada-pos-numero" style="font-size:20px;">${fmtDifFinal(remontadaTiempo.difFinalSegundos)}</div>
                        <div class="remontada-pos-label">Actual</div>
                    </div>
                </div>
                <div class="remontada-ganancia">
                    Recortó <strong>${fmtDif(remontadaTiempo.recorteSegundos)}</strong> al líder desde su peor momento (tras PE ${remontadaTiempo.desdePE})
                </div>
            </div>
        `
        : `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (tiempo)</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // ── HTML: mejor remontada por POSICIÓN ──
    const htmlRemontadaPos = remontadaPos && remontadaPos.ganancia > 0
        ? `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (posición)</div>
                <div class="remontada-piloto">${remontadaPos.nombre}</div>
                <span class="remontada-badge">+${remontadaPos.ganancia} posicion${remontadaPos.ganancia !== 1 ? 'es' : ''}</span>
                <div class="remontada-posiciones">
                    <div class="remontada-pos-inicio">
                        <div class="remontada-pos-numero">${remontadaPos.posInicio}°</div>
                        <div class="remontada-pos-label">tras PE ${remontadaPos.desdePE}</div>
                    </div>
                    <div class="remontada-flecha">→</div>
                    <div class="remontada-pos-fin">
                        <div class="remontada-pos-numero">${remontadaPos.posFin}°</div>
                        <div class="remontada-pos-label">Actual</div>
                    </div>
                </div>
                <div class="remontada-ganancia">
                    Ganó <strong>${remontadaPos.ganancia}</strong> lugar${remontadaPos.ganancia !== 1 ? 'es' : ''} desde su peor posición (tras PE ${remontadaPos.desdePE})
                </div>
            </div>
        `
        : `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (posición)</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // ── HTML: tramo más disputado ──
    const fmtDifDisputado = seg => {
        const total = Math.abs(seg);
        const m   = Math.floor(total / 60);
        const s   = Math.floor(total % 60);
        const dec = Math.round((total % 1) * 1000); // 3 decimales
        const decStr = String(dec).padStart(3, '0');
        const sStr = `${s}.${decStr}s`;
        return m > 0 ? `${m}m ${sStr}` : sStr;
    };
    const htmlTramoDisputado = tramoDisputado
        ? `
            <div class="tarjeta-disputado">
                <div class="seccion-titulo">Tramo más disputado</div>
                <div class="disputado-header">
                    <span class="disputado-pe">PE ${tramoDisputado.pe}</span>
                    <span class="disputado-nombre">| ${tramoDisputado.nombre}</span>
                </div>
                <div class="disputado-dif">${fmtDifDisputado(tramoDisputado.difSegundos)}</div>
                <div class="disputado-dif-label">de diferencia entre 1° y 2°</div>
                <div class="disputado-tiempos">
                    <span><span class="disputado-badge disputado-badge-1">1</span>${tramoDisputado.tiempo1}</span>
                    <span><span class="disputado-badge disputado-badge-2">2</span>${tramoDisputado.tiempo2}</span>
                </div>
            </div>
        `
        : `
            <div class="tarjeta-disputado">
                <div class="seccion-titulo">Tramo más disputado</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // ── HTML: fila inferior ──
    const htmlFilaInferior = `
        <div class="fila-inferior">
            ${htmlVelocidad}
            ${htmlConsistente}
            ${htmlTramoDisputado}
            ${htmlRemontadaTiempo}
            ${htmlRemontadaPos}
        </div>
    `;

    contenedor.innerHTML = htmlResumen + htmlGanadores + htmlFilaInferior;
}

// ── Carga de datos ────────────────────────────────────────────────────────────

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    document.getElementById('lastUpdate').textContent =
        `Última actualización: ${ahora.toLocaleTimeString('es-AR')}`;
}

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;

        const [respPilotos, respTramos] = await Promise.all([
            fetch(URL_PILOTOS + cacheBuster),
            fetch(URL_TRAMOS  + cacheBuster)
        ]);

        datosPilotos = analizarPilotosCSV(await respPilotos.text());
        datosTramos  = analizarTramosCSV(await respTramos.text());

        const categorias = obtenerCategoriasConTiempos();
        renderizarBotonesCategorias(categorias);

        // Seleccionar la primera categoría automáticamente si no hay ninguna activa
        if (!categoriaActiva && categorias.length > 0) {
            seleccionarCategoria(categorias[0]);
        } else if (categoriaActiva) {
            seleccionarCategoria(categoriaActiva);
        } else {
            document.getElementById('content').innerHTML =
                '<div class="no-data">No hay tiempos cargados todavía.</div>';
        }

        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

cargarDatos();
setInterval(cargarDatos, 30000);