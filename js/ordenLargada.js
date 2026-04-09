const ORDENLARGADA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeo0wYsc5ti8yBhljZLKklf7VXplQSmbAQS3GtdGokmvwQcj7X7QVGOX9h3jTh045B5O8vr6jb2G7U/pub?gid=1217848665&single=true&output=csv';
const { analizarCSV } = window.UtilidadesCSV;

let ordenLargadaData = [];
let intervaloContador = null;

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;
        const response = await fetch(ORDENLARGADA_URL + cacheBuster);
        const text = await response.text();

        ordenLargadaData = analizarCSV(text, {
            filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE) && (fila.Categoria || fila.CATEGORIA))
        });

        renderizarOrdenLargada();
        actualizarContadorProximaLargada();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">âš ï¸ Error al cargar los datos. Por favor, verifica que la hoja de cÃ¡lculo estÃ© publicada correctamente.</div>';
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
        return horas === 1 ? '1 hora' : `${horas} horas`;
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
        containerContador.innerHTML = '<div class="sin-largadas">ðŸ No hay largadas programadas prÃ³ximamente</div>';
        return;
    }

    const minutosRestantes = proximasLargadas[0].minutosRestantes;
    const segundosRestantes = 60 - new Date().getSeconds();

    let estadoTexto = '';
    let estadoClass = '';

    if (minutosRestantes === 0) {
        estadoTexto = 'Â¡LARGANDO AHORA!';
        estadoClass = 'largando-ahora';
    } else if (minutosRestantes <= 5) {
        estadoTexto = `PrÃ³xima largada en ${minutosRestantes} min ${segundosRestantes}s`;
        estadoClass = 'urgente';
    } else if (minutosRestantes <= 15) {
        estadoTexto = `PrÃ³xima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'cercana';
    } else {
        estadoTexto = `PrÃ³xima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'normal';
    }

    const pilotosHTML = proximasLargadas.map(p => `
        <div class="info-piloto">
            <div class="info-item">
                <span class="label">Piloto:</span>
                <span class="valor nombre">${p.nombre}</span>
            </div>
            <div class="info-item">
                <span class="label">CategorÃ­a:</span>
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

function renderizarOrdenLargada() {
    if (ordenLargadaData.length === 0) {
        document.getElementById('content').innerHTML =
            '<div class="error">âŒ No se encontraron ordenes de largadas.</div>';
        return;
    }

    const columnasSS = obtenerColumnasSS();

    const datosOrdenados = [...ordenLargadaData].sort((a, b) => {
        const tiempoA = obtenerHorarioMasTemplano(a, columnasSS);
        const tiempoB = obtenerHorarioMasTemplano(b, columnasSS);
        return tiempoA - tiempoB;
    });

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
                            <th>CategorÃ­a</th>
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

function actualizarUltimaActualizacion() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent =
        `ðŸ”„ Ãšltima actualizaciÃ³n: ${timeStr}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);

if (intervaloContador) {
    clearInterval(intervaloContador);
}
intervaloContador = setInterval(actualizarContadorProximaLargada, 1000);
