window.UtilidadesCSV = (function () {
    function normalizarColumnasEtapa(fila) {
        Object.keys(fila)
            .filter(clave => /^(PE|SS)\d+$/.test(clave))
            .forEach(clave => {
                const numero = clave.replace(/^(PE|SS)/, '');
                const alias = clave.startsWith('PE') ? `SS${numero}` : `PE${numero}`;

                if (fila[clave] !== '' && fila[alias] === undefined) {
                    fila[alias] = fila[clave];
                }
            });

        return fila;
    }

    function analizarCSV(csv, opciones = {}) {
        const {
            transformarEncabezados = (encabezado) => encabezado.trim(),
            mapearFila = null,
            filtrarFila = null
        } = opciones;

        const lineas = csv.trim().split('\n');
        const encabezados = lineas[0].split(',').map(transformarEncabezados);
        const datos = [];

        for (let i = 1; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            const valores = lineas[i].split(',').map(valor => valor.trim());
            const fila = {};

            encabezados.forEach((encabezado, indice) => {
                fila[encabezado] = valores[indice] || '';
            });

            normalizarColumnasEtapa(fila);

            if (filtrarFila && !filtrarFila(fila)) continue;

            datos.push(mapearFila ? mapearFila(fila) : fila);
        }

        return datos;
    }

    return {
        analizarCSV
    };
})();
