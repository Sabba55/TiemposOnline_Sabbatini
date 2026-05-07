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

// Cuenta cuántas veces ganó cada piloto un PE en esa categoría.
// Devuelve: { lideres: [{nombre, victorias}], todosDistintos: bool }
function calcularMayorGanador(ganadoresPorTramo) {
    const conteo = {};

    ganadoresPorTramo.forEach(({ ganador }) => {
        conteo[ganador] = (conteo[ganador] || 0) + 1;
    });

    const ordenados = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1]);

    if (ordenados.length === 0) return null;

    // Si cada piloto ganó exactamente 1 PE y hay más de 1 PE disputado → todos distintos
    const maxVictorias = ordenados[0][1];
    const todosDistintos = maxVictorias === 1 && ordenados.length > 1;

    // Todos los que empatan en el máximo
    const lideres = ordenados
        .filter(([, v]) => v === maxVictorias)
        .map(([nombre, victorias]) => ({ nombre, victorias }));

    return { lideres, todosDistintos };
}

// Marca más ganadora: la marca con más victorias de tramo en la categoría
function calcularMarcaMasGanadora(ganadoresPorTramo, categoria) {
    const conteo = {};

    ganadoresPorTramo.forEach(({ ganador }) => {
        // Buscar el vehículo del piloto ganador
        const piloto = pilotosDeCat(categoria).find(
            p => (p.Nombre || p.NOMBRE) === ganador
        );
        if (!piloto) return;

        const vehiculo = piloto.Vehiculo || piloto.VEHICULO || piloto.vehiculo || '';
        if (!vehiculo) return;

        const marca = vehiculo.trim().split(' ')[0]; // primera palabra = marca
        if (!marca) return;

        conteo[marca] = (conteo[marca] || 0) + 1;
    });

    const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    if (ordenados.length === 0) return null;

    const maxVictorias = ordenados[0][1];
    const marcasLideres = ordenados
        .filter(([, v]) => v === maxVictorias)
        .map(([marca, victorias]) => ({ marca, victorias }));

    return { marcasLideres, todosDistintos: maxVictorias === 1 && ordenados.length > 1 };
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

            // Obtener nombres del 1° y 2° en este tramo
            const pilotosOrdenados = pilotosDeCat(categoria)
                .filter(p => p[columna] && p[columna].trim() !== '' && !esDNF(p[columna]))
                .map(p => ({ nombre: p.Nombre || p.NOMBRE || '', seg: tiempoASegundos(p[columna]) }))
                .filter(p => p.seg < 999999)
                .sort((a, b) => a.seg - b.seg);

            resultado = {
                pe,
                kms: tramo.KMS || null,
                nombre: tramo.Desde && tramo.Hasta ? `${tramo.Desde} - ${tramo.Hasta}` : `PE ${pe}`,
                difSegundos: dif,
                tiempo1: segundosATiempo(tiempos[0], 3),
                tiempo2: segundosATiempo(tiempos[1], 3),
                piloto1: pilotosOrdenados[0]?.nombre ?? '',
                piloto2: pilotosOrdenados[1]?.nombre ?? ''
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

    // Solo interesan los grupos que aparecen 2 o más veces (tramos repetidos)
    const gruposRepetidos = Object.entries(gruposPorNombre)
        .filter(([, pes]) => pes.length >= 2);

    if (gruposRepetidos.length === 0) return null;

    const candidatos = [];

    pilotosDeCat(categoria).forEach(piloto => {
        const cvsPorGrupo = [];
        let tramosCompletados = 0;

        gruposRepetidos.forEach(([, pes]) => {
            const tiemposDelGrupo = [];
            pes.forEach(pe => {
                const tiempo = piloto[`SS${pe}`];
                if (!tiempo || tiempo.trim() === '' || esDNF(tiempo)) return;
                const seg = tiempoASegundos(tiempo);
                if (seg < 999999) tiemposDelGrupo.push(seg);
            });

            // Solo usar este grupo si el piloto completó al menos 2 pasadas
            if (tiemposDelGrupo.length < 2) return;

            const promedio = tiemposDelGrupo.reduce((a, b) => a + b, 0) / tiemposDelGrupo.length;
            const varianza = tiemposDelGrupo.reduce((sum, t) => sum + Math.pow(t - promedio, 2), 0) / tiemposDelGrupo.length;
            const desvio   = Math.sqrt(varianza);

            // Coeficiente de variación: desvío relativo al promedio del grupo (%)
            // Esto hace que tramos cortos y largos pesen igual
            const cv = promedio > 0 ? (desvio / promedio) * 100 : 0;

            cvsPorGrupo.push(cv);
            tramosCompletados += tiemposDelGrupo.length;
        });

        // El piloto necesita al menos un grupo válido para ser candidato
        if (cvsPorGrupo.length === 0) return;

        // Consistencia final = promedio de los CV de cada grupo
        const cvPromedio = cvsPorGrupo.reduce((a, b) => a + b, 0) / cvsPorGrupo.length;

        candidatos.push({
            nombre: piloto.Nombre || piloto.NOMBRE || '',
            cv: cvPromedio,
            tramosCompletados
        });
    });

    if (candidatos.length === 0) return null;

    // Menor CV = más consistente
    candidatos.sort((a, b) => a.cv - b.cv);
    const mejor = candidatos[0];

    return {
        nombre: mejor.nombre,
        desvio: mejor.cv.toFixed(2), // ahora es CV en %, mantenemos el campo "desvio" para no romper el render
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

// Piloto que más posiciones perdió: desde su MEJOR posición acumulada en cualquier PE hasta el resultado final
function calcularPilotoMasPosicionesPerdidas(categoria) {
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

    const posicionesPorPE = [];
    for (let pe = 1; pe <= ultimoPE; pe++) {
        posicionesPorPE.push(calcularPosicionesAcumuladas(categoria, pe));
    }

    const posicionesFinal = posicionesPorPE[ultimoPE - 1];

    let peorCaso = null;
    let mayorPerdida = -Infinity;

    Object.keys(posicionesFinal).forEach(nombre => {
        const posFin = posicionesFinal[nombre];

        // Buscar la MEJOR posición (número más bajo) en PEs anteriores al último
        let mejorPos = Infinity;
        let mejorPE  = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const pos = posicionesPorPE[pe - 1][nombre];
            if (!pos) continue;
            if (pos < mejorPos) { mejorPos = pos; mejorPE = pe; }
        }

        if (mejorPE === null || mejorPos >= posFin) return;

        const perdida = posFin - mejorPos;
        if (perdida > mayorPerdida) {
            mayorPerdida = perdida;
            peorCaso = { nombre, posMejor: mejorPos, posFin, perdida, desdePE: mejorPE };
        }
    });

    return peorCaso;
}
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
    const marcaMasGanadora = calcularMarcaMasGanadora(ganadoresPE, categoria);
    const velocidadMax     = calcularVelocidadMaxima(categoria);
    const consistente      = calcularPilotoMasConsistente(categoria);
    const remontadaTiempo  = calcularRemontadaPorTiempo(categoria);
    const remontadaPos     = calcularRemontadaPorPosicion(categoria);
    const tramoDisputado   = calcularTramoMasDisputado(categoria);
    const posicionesPerdidas = calcularPilotoMasPosicionesPerdidas(categoria);

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

    // ── HTML: ganadores por tramo + tarjetas derechas ──
    let htmlFilasGanadores = '';
    if (ganadoresPE.length === 0) {
        htmlFilasGanadores = `<tr><td colspan="3" class="no-data">Sin tiempos registrados</td></tr>`;
    } else {
        ganadoresPE.forEach(({ pe, ganador, tiempo }) => {
            htmlFilasGanadores += `
                <tr>
                    <td class="col-pos"><div class="pe-cell"><span class="pe-badge">PE ${pe}</span></div></td>
                    <td class="col-ganador"><div class="piloto-cell">${ganador}</div></td>
                    <td class="col-tiempo tiempo-cell"><span class="tiempo-val">${tiempo}</span></td>
                </tr>
            `;
        });
    }

    // Tarjeta mayor ganador (con empates y caso todos-distintos)
    let htmlMayorGanador = '';
    if (mayorGanador) {
        if (mayorGanador.todosDistintos) {
            htmlMayorGanador = `
                <div class="tarjeta-mayor-ganador">
                    <div class="mayor-ganador-label">Mayor ganador de tramos</div>
                    <div class="mayor-ganador-todos-distintos">Cada tramo fue ganado por un piloto diferente</div>
                </div>
            `;
        } else {
            const nombresHTML = mayorGanador.lideres
                .map(l => `<div class="mayor-ganador-nombre">${l.nombre}</div>`)
                .join('');
            const etiqueta = mayorGanador.lideres.length > 1 ? 'Mayor ganadores de tramos' : 'Mayor ganador de tramos';
            htmlMayorGanador = `
                <div class="tarjeta-mayor-ganador">
                    <div class="mayor-ganador-label">${etiqueta}</div>
                    ${nombresHTML}
                    <div class="mayor-ganador-victorias">${mayorGanador.lideres[0].victorias}</div>
                    <div class="mayor-ganador-victorias-label">victoria${mayorGanador.lideres[0].victorias !== 1 ? 's' : ''}</div>
                </div>
            `;
        }
    }

    // Tarjeta marca más ganadora
    let htmlMarcaMasGanadora = '';
    if (marcaMasGanadora) {
        const { obtenerRutaLogoMarca } = window.UtilidadesIconos;
        if (marcaMasGanadora.todosDistintos) {
            htmlMarcaMasGanadora = `
                <div class="tarjeta-mayor-ganador tarjeta-marca-ganadora">
                    <div class="mayor-ganador-label">Marca más ganadora de tramos</div>
                    <div class="mayor-ganador-todos-distintos">Cada tramo fue ganado por una marca diferente</div>
                </div>
            `;
        } else {
            const marcasHTML = marcaMasGanadora.marcasLideres.map(({ marca }) => {
                const logo = obtenerRutaLogoMarca(marca + ' x');
                const esToyota = marca.trim().toLowerCase() === 'toyota';
                const logoStyle = esToyota ? 'style="filter: brightness(0) invert(1);"' : '';
                return `
                    <div class="marca-ganadora-fila">
                        ${logo ? `<img src="${logo}" alt="${marca}" class="marca-ganadora-logo" ${logoStyle} onerror="this.style.display='none'">` : ''}
                        <span class="mayor-ganador-nombre" style="margin:0;">${marca}</span>
                    </div>
                `;
            }).join('');
            const etiquetaMarca = marcaMasGanadora.marcasLideres.length > 1 ? 'Marcas más ganadoras' : 'Marca más ganadora de tramos';
            htmlMarcaMasGanadora = `
                <div class="tarjeta-mayor-ganador tarjeta-marca-ganadora">
                    <div class="mayor-ganador-label">${etiquetaMarca}</div>
                    ${marcasHTML}
                    <div class="mayor-ganador-victorias">${marcaMasGanadora.marcasLideres[0].victorias}</div>
                    <div class="mayor-ganador-victorias-label">victoria${marcaMasGanadora.marcasLideres[0].victorias !== 1 ? 's' : ''}</div>
                </div>
            `;
        }
    }

    const htmlGanadores = `
        <div class="ganadores-layout">
            <div>
                <div class="seccion-titulo">Ganadores por tramo</div>
                <div class="tbl-ganadores-outer">
                    <table>
                        <thead>
                            <tr>
                                <th class="center">PE</th>
                                <th>Ganador</th>
                                <th class="center">Tiempo</th>
                            </tr>
                        </thead>
                        <tbody>${htmlFilasGanadores}</tbody>
                    </table>
                </div>
            </div>
            <div class="ganadores-derecha">
                ${htmlMayorGanador}
                ${htmlMarcaMasGanadora}
            </div>
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
                <div class="consistencia-desvio">${consistente.desvio}%</div>
                <div class="consistencia-desvio-label">variación promedio</div>
                <div class="consistencia-explicacion">
                    Menor variación porcentual de tiempos entre tramos repetidos.
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
                    <span>
                        <span class="disputado-badge disputado-badge-1">1</span>
                        <span style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">
                            <span style="font-size:11px;font-weight:600;color:#334155;">${tramoDisputado.piloto1}</span>
                            <span>${tramoDisputado.tiempo1}</span>
                        </span>
                    </span>
                    <span>
                        <span class="disputado-badge disputado-badge-2">2</span>
                        <span style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">
                            <span style="font-size:11px;font-weight:600;color:#334155;">${tramoDisputado.piloto2}</span>
                            <span>${tramoDisputado.tiempo2}</span>
                        </span>
                    </span>
                </div>

            </div>
        `
        : `
            <div class="tarjeta-disputado">
                <div class="seccion-titulo">Tramo más disputado</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    // ── HTML: piloto que más posiciones perdió ──
    const htmlPosicionesPerdidas = posicionesPerdidas && posicionesPerdidas.perdida > 0
        ? `
            <div class="tarjeta-remontada tarjeta-perdida">
                <div class="seccion-titulo">Más posiciones perdidas</div>
                <div class="remontada-piloto">${posicionesPerdidas.nombre}</div>
                <span class="remontada-badge perdida-badge">−${posicionesPerdidas.perdida} posicion${posicionesPerdidas.perdida !== 1 ? 'es' : ''}</span>
                <div class="remontada-posiciones">
                    <div class="remontada-pos-inicio">
                        <div class="remontada-pos-numero perdida-pos-mejor">${posicionesPerdidas.posMejor}°</div>
                        <div class="remontada-pos-label">tras PE ${posicionesPerdidas.desdePE}</div>
                    </div>
                    <div class="remontada-flecha perdida-flecha">→</div>
                    <div class="remontada-pos-fin">
                        <div class="remontada-pos-numero perdida-pos-fin">${posicionesPerdidas.posFin}°</div>
                        <div class="remontada-pos-label">Actual</div>
                    </div>
                </div>
                <div class="remontada-ganancia perdida-ganancia">
                    Cayó <strong>${posicionesPerdidas.perdida}</strong> lugar${posicionesPerdidas.perdida !== 1 ? 'es' : ''} desde su mejor posición (tras PE ${posicionesPerdidas.desdePE})
                </div>
            </div>
        `
        : `
            <div class="tarjeta-remontada tarjeta-perdida">
                <div class="seccion-titulo">Más posiciones perdidas</div>
                <div class="no-data">Sin información</div>
            </div>
        `;

    const htmlEvolucion = renderizarEvolucionTop5(categoria);

    // ── HTML: fila inferior ──
    const htmlFilaInferior = `
        <div class="fila-inferior">
            ${htmlVelocidad}
            ${htmlConsistente}
            ${htmlTramoDisputado}
            ${htmlRemontadaTiempo}
            ${htmlRemontadaPos}
            ${htmlPosicionesPerdidas}
        </div>
    `;

    contenedor.innerHTML = htmlResumen + htmlGanadores + htmlEvolucion + htmlFilaInferior;
}

// ── Evolución Top 5 ───────────────────────────────────────────────────────────

function calcularEvolucionTop5(categoria) {
    const totalPEs = datosTramos.length;
    let ultimoPE = 0;
    for (let i = totalPEs; i >= 1; i--) {
        const col = `SS${i}`;
        const hay = pilotosDeCat(categoria).some(p => p[col] && p[col].trim() !== '');
        if (hay) { ultimoPE = i; break; }
    }
    if (ultimoPE === 0) return null;

    // Posiciones acumuladas en cada PE
    const snapshots = [];
    for (let pe = 1; pe <= ultimoPE; pe++) {
        snapshots.push(calcularPosicionesAcumuladas(categoria, pe));
    }

    // Recolectar todos los pilotos que estuvieron en top 5 en ALGÚN PE
    const pilotosEnTop5 = new Set();
    snapshots.forEach(snap => {
        Object.entries(snap)
            .filter(([, pos]) => pos <= 5)
            .forEach(([nombre]) => pilotosEnTop5.add(nombre));
    });

    if (pilotosEnTop5.size === 0) return null;

    // Para cada piloto, construir puntos SOLO en los PEs donde estuvo en top 5
    const series = [...pilotosEnTop5].map(nombre => {
        const puntos = [];
        for (let pe = 1; pe <= ultimoPE; pe++) {
            const pos = snapshots[pe - 1][nombre];
            if (pos !== undefined && pos <= 5) {
                puntos.push({ pe, pos });
            }
        }
        // Posición final (en el último PE donde aparece)
        const ultimoSnap = snapshots[ultimoPE - 1];
        const posFinal = ultimoSnap[nombre] ?? null;
        return { nombre, puntos, posFinal };
    });

    // Ordenar por posición final (los que terminaron mejor primero, los que salieron del top al final)
    series.sort((a, b) => {
        const pa = a.posFinal ?? 999;
        const pb = b.posFinal ?? 999;
        return pa - pb;
    });

    return { series, totalPEs: ultimoPE };
}

function renderizarEvolucionTop5(categoria) {
    const data = calcularEvolucionTop5(categoria);
    if (!data || data.series.length === 0 || data.totalPEs < 2) return '';

    const { series, totalPEs } = data;

    const W = 860, H = 260;
    const PAD = { top: 20, right: 160, bottom: 40, left: 48 };
    const gW = W - PAD.left - PAD.right;
    const gH = H - PAD.top - PAD.bottom;

    const xScale = pe => PAD.left + ((pe - 1) / Math.max(totalPEs - 1, 1)) * gW;
    const yScale = pos => PAD.top + ((pos - 1) / 5) * gH;
    const Y_FUERA = yScale(6);

    const COLORES = [
        '#ffab1a', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
        '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
        '#8b5cf6', '#f59e0b',
    ];

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">`;
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;

    // Grilla horizontal — solo posiciones 1 a 5
    for (let pos = 1; pos <= 5; pos++) {
        const y = yScale(pos);
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + gW}" y2="${y}"
            stroke="#d7dde5" stroke-width="${pos === 1 ? 1.5 : 1}" stroke-dasharray="${pos === 1 ? 'none' : '4,3'}"/>`;
        svg += `<text x="${PAD.left - 10}" y="${y + 4.5}" text-anchor="end"
            font-size="11" font-weight="700" font-family="Orbitron,serif" fill="#5a6472">${pos}°</text>`;
    }

    // Grilla vertical por PE
    for (let pe = 1; pe <= totalPEs; pe++) {
        const x = xScale(pe);
        svg += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + gH}"
            stroke="#e2e8f0" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${PAD.top + gH + 18}" text-anchor="middle"
            font-size="11" font-weight="600" font-family="Orbitron,serif" fill="#303743">PE ${pe}</text>`;
    }

    // Líneas y puntos por piloto
    series.forEach(({ nombre, puntos }, idx) => {
        if (puntos.length === 0) return;
        const color = COLORES[idx % COLORES.length];

        // Agrupar puntos en segmentos consecutivos dentro del top 5
        const segmentos = [];
        let segActual = null;

        for (let pe = 1; pe <= totalPEs; pe++) {
            const punto = puntos.find(p => p.pe === pe);
            if (punto) {
                if (!segActual) segActual = [];
                segActual.push(punto);
            } else {
                if (segActual) {
                    segmentos.push(segActual);
                    segActual = null;
                }
            }
        }
        if (segActual) segmentos.push(segActual);

        segmentos.forEach((seg, iSeg) => {
            const primero = seg[0];
            const ultimo = seg[seg.length - 1];

            const esPrimerPE = primero.pe === 1;
            const esUltimoPE = ultimo.pe === totalPEs;

            // Línea de entrada: punteada desde Y_FUERA hasta el primer punto del segmento
            if (!esPrimerPE) {
                const dEntrada = `M${xScale(primero.pe - 1).toFixed(1)},${Y_FUERA.toFixed(1)} L${xScale(primero.pe).toFixed(1)},${yScale(primero.pos).toFixed(1)}`;
                svg += `<path d="${dEntrada}" fill="none" stroke="${color}" stroke-width="2"
                    stroke-dasharray="4,3" stroke-linecap="round" opacity="0.4"/>`;
            }

            // Línea sólida dentro del top 5
            if (seg.length > 1) {
                const dSolido = seg.map((p, i) =>
                    `${i === 0 ? 'M' : 'L'}${xScale(p.pe).toFixed(1)},${yScale(p.pos).toFixed(1)}`
                ).join(' ');
                svg += `<path d="${dSolido}" fill="none" stroke="${color}" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
            }

            // Línea de salida: punteada desde el último punto del segmento hacia Y_FUERA
            if (!esUltimoPE) {
                const dSalida = `M${xScale(ultimo.pe).toFixed(1)},${yScale(ultimo.pos).toFixed(1)} L${xScale(ultimo.pe + 1).toFixed(1)},${Y_FUERA.toFixed(1)}`;
                svg += `<path d="${dSalida}" fill="none" stroke="${color}" stroke-width="2"
                    stroke-dasharray="4,3" stroke-linecap="round" opacity="0.4"/>`;
            }

            // Puntos solo dentro del top 5
            seg.forEach(({ pe, pos }) => {
                svg += `<circle cx="${xScale(pe).toFixed(1)}" cy="${yScale(pos).toFixed(1)}"
                    r="5" fill="${color}" stroke="white" stroke-width="2"/>`;
            });
        });

        // Etiqueta al final del último segmento
        const ultimoSeg = segmentos[segmentos.length - 1];
        const ultimoPunto = ultimoSeg[ultimoSeg.length - 1];
        const lx = (xScale(ultimoPunto.pe) + 10).toFixed(1);
        const ly = (yScale(ultimoPunto.pos) + 4.5).toFixed(1);
        const nombreCorto = nombre.length > 18 ? nombre.split(' ').slice(-1)[0] : nombre;
        svg += `<text x="${lx}" y="${ly}" font-size="11.5" font-weight="700"
            font-family="'Segoe UI',sans-serif" fill="${color}">${nombreCorto}</text>`;
    });

    svg += `</svg>`;

    const leyenda = series.map(({ nombre }, idx) => {
        const color = COLORES[idx % COLORES.length];
        return `
            <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#161c25;">
                <svg width="22" height="4"><rect width="22" height="4" rx="2" fill="${color}"/></svg>
                <span>${nombre}</span>
            </div>`;
    }).join('');

    return `
        <div style="margin-bottom:30px;">
            <div class="seccion-titulo">Evolución Top 5</div>
            <div style="background:#f8fafc;border:1.5px solid #d7dde5;border-radius:12px;padding:18px 18px 10px;box-shadow:0 4px 14px rgba(15,23,42,0.07);">
                ${svg}
                <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;justify-content:center;">
                    ${leyenda}
                </div>
            </div>
        </div>
    `;
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
        // Solo mostrar error si no hay datos previos (primera carga)
        const hayDatos = datosPilotos.length > 0 || datosTramos.length > 0;
        if (!hayDatos) {
            document.getElementById('content').innerHTML =
                '<div class="error">Error al cargar los datos.</div>';
        }
        // Si ya había datos, simplemente ignoramos el error silenciosamente
        console.error('Error al recargar:', error);
    }
}

cargarDatos();
setInterval(cargarDatos, 30000);