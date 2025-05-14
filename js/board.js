/**
 * board.js - Lógica del tablero para Planchis Online
 */

// Definición de las líneas del tablero
const boardLines = {
    "Rojo_Humedo": { type: "vertical", col: 6, minRow: 0, maxRow: 5 },
    "Rojo_Seco": { type: "horizontal", row: 6, minCol: 0, maxCol: 5 },
    "Amarillo_Humedo": { type: "horizontal", row: 8, minCol: 0, maxCol: 5 },
    "Amarillo_Seco": { type: "vertical", col: 6, minRow: 9, maxRow: 14 },
    "Verde_Humedo": { type: "vertical", col: 8, minRow: 9, maxRow: 14 },
    "Verde_Seco": { type: "horizontal", row: 8, minCol: 9, maxCol: 14 },
    "Azul_Humedo": { type: "horizontal", row: 6, minCol: 9, maxCol: 14 },
    "Azul_Seco": { type: "vertical", col: 8, minRow: 0, maxRow: 5 }
};

// Definición de las adyacencias entre líneas
const adjacentLines = {
    "Rojo_Humedo": ["Rojo_Seco", "Azul_Seco"],
    "Rojo_Seco": ["Rojo_Humedo", "Amarillo_Humedo"],
    "Amarillo_Humedo": ["Rojo_Seco", "Amarillo_Seco"],
    "Amarillo_Seco": ["Amarillo_Humedo", "Verde_Humedo"],
    "Verde_Humedo": ["Amarillo_Seco", "Verde_Seco"],
    "Verde_Seco": ["Verde_Humedo", "Azul_Humedo"],
    "Azul_Humedo": ["Verde_Seco", "Azul_Seco"],
    "Azul_Seco": ["Azul_Humedo", "Rojo_Humedo"]
};

// Mapeo de casas de cada jugador a las líneas iniciales
const playerStartLines = {
    0: ["Verde_Humedo", "Verde_Seco"], // Jugador 1 (Verde)
    1: ["Azul_Humedo", "Azul_Seco"],   // Jugador 2 (Azul)
    2: ["Rojo_Humedo", "Rojo_Seco"],   // Jugador 3 (Rosa)
    3: ["Amarillo_Humedo", "Amarillo_Seco"] // Jugador 4 (Amarillo)
};

// Mapeo de zonas de cruz para ganar
const playerCrossZones = {
    0: { type: "vertical", col: 7, minRow: 8, maxRow: 13, color: "green" }, // Jugador 1 (Verde)
    1: { type: "horizontal", row: 7, minCol: 8, maxCol: 13, color: "blue" }, // Jugador 2 (Azul)
    2: { type: "vertical", col: 7, minRow: 1, maxRow: 6, color: "pink" }, // Jugador 3 (Rosa)
    3: { type: "horizontal", row: 7, minCol: 1, maxCol: 6, color: "yellow" } // Jugador 4 (Amarillo)
};

// Lista de posiciones donde debe aparecer Saturno con fondo azul oscuro
const saturnPositions = [
    { row: 6, col: 6 },
    { row: 6, col: 8 },
    { row: 8, col: 6 },
    { row: 8, col: 8 }
];

// Definición de las casas con sus propiedades
const houseZones = [
    { 
        name: "pink", 
        startRow: 0, 
        startCol: 0, 
        size: 5,
        symbol: "sun", 
        color: "#ff1493"
    },
    { 
        name: "blue", 
        startRow: 0, 
        startCol: 10, 
        size: 5,
        symbol: "moon", 
        color: "#1aa3ff"
    },
    { 
        name: "yellow", 
        startRow: 10, 
        startCol: 0, 
        size: 5,
        symbol: "moon", 
        color: "#ffde00"
    },
    { 
        name: "green", 
        startRow: 10, 
        startCol: 10, 
        size: 5,
        symbol: "sun", 
        color: "#00b050"
    }
];

// Definir los símbolos planetarios 
const symbols = [
    { name: 'Sol', symbol: '☉' },
    { name: 'Luna', symbol: '☽' },
    { name: 'Mercurio', symbol: '☿' },
    { name: 'Venus', symbol: '♀' },
    { name: 'Marte', symbol: '♂' },
    { name: 'Júpiter', symbol: '♃' },
    { name: 'Saturno', symbol: '♄' },
    { name: 'Sol_Rojo', symbol: '☉' },
    { name: 'Luna_Amarillo', symbol: '☽' },
    { name: 'Mercurio_Amarillo', symbol: '☿' },
    { name: 'Venus_Amarillo', symbol: '♀' },
    { name: 'Marte_Azul', symbol: '♂' },
    { name: 'Júpiter_Azul', symbol: '♃' },
    { name: 'Sol_Verde', symbol: '☉' },
    { name: 'Luna_Azul', symbol: '☽' },
    { name: 'Mercurio_Verde', symbol: '☿' },
    { name: 'Venus_Verde', symbol: '♀' },
    { name: 'Marte_Rojo', symbol: '♂' },
    { name: 'Júpiter_Rojo', symbol: '♃' }
];

// Definir las combinaciones del dado (12 posibilidades)
const dadoCombinations = [
    { planet: 'Marte_Rojo', element: 'Fuego', color: 'red' },
    { planet: 'Marte_Azul', element: 'Agua', color: 'blue' },
    { planet: 'Júpiter_Rojo', element: 'Fuego', color: 'red' },
    { planet: 'Júpiter_Azul', element: 'Agua', color: 'blue' },
    { planet: 'Venus_Verde', element: 'Tierra', color: 'green' },
    { planet: 'Venus_Amarillo', element: 'Aire', color: 'yellow' },
    { planet: 'Mercurio_Verde', element: 'Tierra', color: 'green' },
    { planet: 'Mercurio_Amarillo', element: 'Aire', color: 'yellow' },
    { planet: 'Luna_Azul', element: 'Agua', color: 'blue' },
    { planet: 'Luna_Amarillo', element: 'Aire', color: 'yellow' },
    { planet: 'Sol_Rojo', element: 'Fuego', color: 'red' },
    { planet: 'Sol_Verde', element: 'Tierra', color: 'green' }
];

// Definición de casillas seguras para cada jugador (en modo 4 jugadores)
const safeSpots = {
    0: [  // Jugador 1 (Verde)
        { planet: 'Sol_Verde', color: 'green' },
        { planet: 'Mercurio_Verde', color: 'green' },
        { planet: 'Marte_Azul', color: 'blue' }
    ],
    1: [  // Jugador 2 (Azul)
        { planet: 'Luna_Azul', color: 'blue' },
        { planet: 'Venus_Verde', color: 'green' },
        { planet: 'Júpiter_Azul', color: 'blue' }
    ],
    2: [  // Jugador 3 (Rosa)
        { planet: 'Sol_Rojo', color: 'red' },
        { planet: 'Mercurio_Amarillo', color: 'yellow' },
        { planet: 'Marte_Rojo', color: 'red' }
    ],
    3: [  // Jugador 4 (Amarillo)
        { planet: 'Luna_Amarillo', color: 'yellow' },
        { planet: 'Venus_Amarillo', color: 'yellow' },
        { planet: 'Júpiter_Rojo', color: 'red' }
    }
};

// Limpiar resaltados en el tablero
function clearHighlights() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('highlight-move');
    });
    
    // También limpiar cualquier resaltado de ficha seleccionada
    const pieces = document.querySelectorAll('.piece');
    pieces.forEach(piece => {
        piece.classList.remove('selected-piece');
    });
    
    // Limpiar selección de casa
    const selectedHouse = document.querySelector('.selected-house');
    if (selectedHouse) {
        selectedHouse.classList.remove('selected-house');
    }
    
    // Resetear modo de casa seleccionada
    gameState.houseSelected = false;
}

// Verificar si una posición está lista para entrar a la cruz
function isPositionReadyForCross(row, col, playerIdx) {
    const playerZone = playerCrossZones[playerIdx];
    
    debug(`Verificando si (${row}, ${col}) está listo para cruz de jugador ${playerIdx}`);
    
    // Primero verificar si la celda está en una línea definida
    const cell = gameState.board.find(c => c.row === row && c.col === col);
    if (!cell || !cell.lineName) {
        debug(`La celda no está en una línea definida`);
        return false;
    }
    
    // Para zonas verticales (Verde y Rosa)
    if (playerZone.type === "vertical") {
        // Verde: verificar posiciones para su zona
        if (playerIdx === 0) {
            const startLines = playerStartLines[playerIdx];
            const isInStartLine = startLines.includes(cell.lineName);
            
            if (isInStartLine) {
                debug(`Verde: (${row}, ${col}) está en línea inicial, NO está en posición para cruz`);
                return false;
            }
            
            // Incluir explícitamente las posiciones límite (filas 8 y 9)
            const isReady = (
                (col === 8 || col === 6) && 
                ((row >= playerZone.minRow && row <= playerZone.maxRow) || 
                 // Posiciones especiales para el límite
                 (col === 6 && row === 8) || 
                 (col === 8 && row === 8))
            );
            debug(`Verde: (${row}, ${col}) está en posición: ${isReady}`);
            return isReady;
        }
        // Rosa: verificar posiciones para su zona
        else if (playerIdx === 2) {
            const startLines = playerStartLines[playerIdx];
            const isInStartLine = startLines.includes(cell.lineName);
            
            if (isInStartLine) {
                debug(`Rosa: (${row}, ${col}) está en línea inicial, NO está en posición para cruz`);
                return false;
            }
            
            // Incluir explícitamente las posiciones límite (filas 6 y 7)
            const isReady = (
                (col === 6 || col === 8) && 
                ((row >= playerZone.minRow && row <= playerZone.maxRow) || 
                 // Posiciones especiales para el límite
                 (col === 6 && row === 6) || 
                 (col === 8 && row === 6))
            );
            debug(`Rosa: (${row}, ${col}) está en posición: ${isReady}`);
            return isReady;
        }
    }
    // Para zonas horizontales (Azul y Amarillo)
    else {
        // Azul: verificar posiciones para su zona
        if (playerIdx === 1) {
            const startLines = playerStartLines[playerIdx];
            const isInStartLine = startLines.includes(cell.lineName);
            
            if (isInStartLine) {
                debug(`Azul: (${row}, ${col}) está en línea inicial, NO está en posición para cruz`);
                return false;
            }
            
            // Incluir explícitamente las posiciones límite (columnas 8 y 9)
            const isReady = (
                (row === 6 || row === 8) && 
                ((col >= playerZone.minCol && col <= playerZone.maxCol) || 
                 // Posiciones especiales para el límite
                 (row === 6 && col === 8) || 
                 (row === 8 && col === 8))
            );
            debug(`Azul: (${row}, ${col}) está en posición: ${isReady}`);
            return isReady;
        }
        // Amarillo: verificar posiciones para su zona
        else if (playerIdx === 3) {
            const startLines = playerStartLines[playerIdx];
            const isInStartLine = startLines.includes(cell.lineName);
            
            if (isInStartLine) {
                debug(`Amarillo: (${row}, ${col}) está en línea inicial, NO está en posición para cruz`);
                return false;
            }
            
            // Incluir explícitamente las posiciones límite (columnas 6 y 7)
            const isReady = (
                (row === 8 || row === 6) && 
                ((col >= playerZone.minCol && col <= playerZone.maxCol) || 
                 // Posiciones especiales para el límite
                 (row === 8 && col === 6) || 
                 (row === 6 && col === 6))
            );
            debug(`Amarillo: (${row}, ${col}) está en posición: ${isReady}`);
            return isReady;
        }
    }
    
    debug(`No está en posición de cruz para jugador ${playerIdx}`);
    return false;
}

// Inicializar el tablero con todas las casillas y símbolos
function initializeBoard() {
    const board = document.getElementById('board');
    
    // Limpiar el tablero
    board.innerHTML = '';
    gameState.board = [];
    
    // Tablero 15x15
    const size = 15;

    debug("Inicializando tablero");
    
    // Crear el tablero base
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Posiciones de Saturno en la cruz
            const isSaturnCrossPosition = 
                (row === 0 && col === 7) || // Arriba
                (row === 7 && col === 0) || // Izquierda
                (row === 7 && col === 14) || // Derecha
                (row === 14 && col === 7); // Abajo
                
            // Verificar si esta celda es una posición de Saturno (fondo azul oscuro)
            const isSaturnPosition = saturnPositions.some(
                pos => pos.row === row && pos.col === col
            );
            
            // Inicialmente todas las celdas tienen borde a menos que se indique lo contrario
            let cellHasContent = false;
            
            // Verificar si la celda está en alguna de las casas
            let inHouse = false;
            let houseIndex = -1;
            
            for (let i = 0; i < houseZones.length; i++) {
                const house = houseZones[i];
                if (row >= house.startRow && row < house.startRow + house.size && 
                    col >= house.startCol && col < house.startCol + house.size) {
                    inHouse = true;
                    houseIndex = i;
                    break;
                }
            }
            
            // Verificar si la celda pertenece a una línea específica
            let lineName = null;
            for (const [name, line] of Object.entries(boardLines)) {
                if ((line.type === "horizontal" && row === line.row && col >= line.minCol && col <= line.maxCol) ||
                    (line.type === "vertical" && col === line.col && row >= line.minRow && row <= line.maxRow)) {
                    lineName = name;
                    cell.classList.add('line-highlight');
                    cell.dataset.line = name;
                    break;
                }
            }
            
            // Comprobamos si la celda es parte de la cruz
            let isCellInCross = false;
            let cellCrossColor = null;
            
            // Cruz horizontal - EXCLUIR posiciones extremas (0,7) y (14,7)
            if (row === 7 && col !== 7 && col !== 0 && col !== 14) {
                isCellInCross = true;
                if (col < 7) {
                    cell.style.backgroundColor = '#ffde00'; // Amarillo
                    cellCrossColor = 'yellow';
                } else {
                    cell.style.backgroundColor = '#1aa3ff'; // Azul
                    cellCrossColor = 'blue';
                }
                cellHasContent = true;
            }

            // Cruz vertical - EXCLUIR posiciones extremas (7,0) y (7,14)
            else if (col === 7 && row !== 7 && row !== 0 && row !== 14) {
                isCellInCross = true;
                if (row < 7) {
                    cell.style.backgroundColor = '#ff1493'; // Rosa
                    cellCrossColor = 'pink';
                } else {
                    cell.style.backgroundColor = '#00b050'; // Verde
                    cellCrossColor = 'green';
                }
                cellHasContent = true;
            }
            
            // Centro con SVG personalizado de Corel Draw
            else if (row === 7 && col === 7) {
                cell.style.backgroundColor = '#2a2a8c'; // Azul oscuro
                
                // Crear el contenedor del SVG
                const svgContainer = document.createElement('div');
                svgContainer.className = 'center-container';
                
                // Contenido SVG de la estrella de 8 puntas (ajustado para visualización)
                const svgContent = `
                    <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" 
                         width="90%" height="90%" viewBox="545.87 8701.18 6775.3 6775.3"
                         style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; 
                               image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd">
                      <polygon fill="white" stroke="none" 
                               points="3933.52,8701.18 4496.45,10729.81 6328.95,9693.4 5292.54,11525.9 
                                      7321.17,12088.83 5292.54,12651.76 6328.95,14484.26 4496.45,13447.85 
                                      3933.52,15476.48 3370.59,13447.85 1538.09,14484.26 2574.5,12651.76 
                                      545.87,12088.83 2574.5,11525.9 1538.09,9693.4 3370.59,10729.81" />
                    </svg>
                `;
                
                // Añadir el SVG al contenedor
                svgContainer.innerHTML = svgContent;
                cell.appendChild(svgContainer);
                
                cellHasContent = true;
            }
            // Posición de Saturno
            else if (isSaturnPosition || isSaturnCrossPosition) {
                cell.classList.add('saturn-cell');
                cell.style.backgroundColor = '#000088'; // Azul oscuro
                cellHasContent = true;
            }
            // Casillas sin contenido y fuera de zonas de casa
            else if (!inHouse) {
                cell.classList.add('no-border');
            }
            
            board.appendChild(cell);
            
            // Guardar referencia en el estado del juego
            gameState.board.push({
                row,
                col,
                hasSymbol: false,
                symbol: null,
                symbolColor: null,
                pieces: [],
                inHouse: inHouse,
                houseIndex: houseIndex,
                isSaturnPosition: isSaturnPosition || isSaturnCrossPosition,
                isInCross: isCellInCross,
                crossColor: cellCrossColor,
                lineName: lineName
            });
            
            // Evento de clic para mover fichas
            cell.addEventListener('click', () => handleCellClick(row, col));
        }
    }
    
    // Añadir los overlays de las casas
    for (const house of houseZones) {
        const houseOverlay = document.createElement('div');
        houseOverlay.className = 'house-overlay';
        houseOverlay.style.width = `${house.size * (100/15)}%`;
        houseOverlay.style.height = `${house.size * (100/15)}%`;
        houseOverlay.style.left = `${house.startCol * (100/15)}%`;
        houseOverlay.style.top = `${house.startRow * (100/15)}%`;
        houseOverlay.style.backgroundColor = house.color;
        
        // Añadir el símbolo de la casa en el centro
        const symbolDiv = document.createElement('div');
        symbolDiv.className = `house-symbol ${house.symbol}-symbol`;
        symbolDiv.style.backgroundColor = house.color;
        
        // Añadir atributo para identificar a qué jugador pertenece esta casa
        let playerIndex = -1;
        if (house.name === "green") playerIndex = 0;
        else if (house.name === "blue") playerIndex = 1;
        else if (house.name === "pink") playerIndex = 2;
        else if (house.name === "yellow") playerIndex = 3;
        
        symbolDiv.dataset.house = playerIndex.toString();
        
        // Añadir evento de clic para seleccionar ficha de casa
        symbolDiv.addEventListener('click', () => handleHouseSymbolClick(playerIndex));
        
        houseOverlay.appendChild(symbolDiv);
        board.appendChild(houseOverlay);
    }
    
    // DEFINICIÓN EXPLÍCITA DE CADA SÍMBOLO
    const symbolsMap = [
        // FILA 0
        { row: 0, col: 6, planet: 'Sol_Rojo', color: 'pink' },
        { row: 0, col: 7, planet: 'Saturno', color: 'white' },
        { row: 0, col: 8, planet: 'Júpiter_Rojo', color: 'pink' },
        
        // FILA 1
        { row: 1, col: 6, planet: 'Luna_Azul', color: 'blue' },
        { row: 1, col: 7, planet: 'Júpiter', color: 'white' },
        { row: 1, col: 8, planet: 'Marte_Azul', color: 'blue' },
        
        // FILA 2
        { row: 2, col: 6, planet: 'Mercurio_Amarillo', color: 'yellow' },
        { row: 2, col: 7, planet: 'Marte', color: 'white' },
        { row: 2, col: 8, planet: 'Venus_Amarillo', color: 'yellow' },
        
        // FILA 3
        { row: 3, col: 6, planet: 'Venus_Verde', color: 'green' },
        { row: 3, col: 7, planet: 'Venus', color: 'white' },
        { row: 3, col: 8, planet: 'Mercurio_Verde', color: 'green' },
        
        // FILA 4
        { row: 4, col: 6, planet: 'Marte_Rojo', color: 'pink' },
        { row: 4, col: 7, planet: 'Mercurio', color: 'white' },
        { row: 4, col: 8, planet: 'Luna_Amarillo', color: 'yellow' },
        
        // FILA 5
        { row: 5, col: 6, planet: 'Júpiter_Azul', color: 'blue' },
        { row: 5, col: 7, planet: 'Luna', color: 'white' },
        { row: 5, col: 8, planet: 'Sol_Verde', color: 'green' },
        
        // FILA 6
        { row: 6, col: 0, planet: 'Júpiter_Rojo', color: 'pink' },
        { row: 6, col: 1, planet: 'Marte_Azul', color: 'blue' },
        { row: 6, col: 2, planet: 'Venus_Amarillo', color: 'yellow' },
        { row: 6, col: 3, planet: 'Mercurio_Verde', color: 'green' },
        { row: 6, col: 4, planet: 'Luna_Amarillo', color: 'yellow' },
        { row: 6, col: 5, planet: 'Sol_Verde', color: 'green' },
        { row: 6, col: 6, planet: 'Saturno', color: 'white' },
        { row: 6, col: 7, planet: 'Sol', color: 'white' },
        { row: 6, col: 8, planet: 'Saturno', color: 'white' },
        { row: 6, col: 9, planet: 'Júpiter_Azul', color: 'blue' },
        { row: 6, col: 10, planet: 'Marte_Rojo', color: 'pink' },
        { row: 6, col: 11, planet: 'Venus_Verde', color: 'green' },
        { row: 6, col: 12, planet: 'Mercurio_Amarillo', color: 'yellow' },
        { row: 6, col: 13, planet: 'Luna_Azul', color: 'blue' },
        { row: 6, col: 14, planet: 'Sol_Rojo', color: 'pink' },
        
        // FILA 7 - CRUZ HORIZONTAL
        { row: 7, col: 0, planet: 'Saturno', color: 'white' },
        { row: 7, col: 1, planet: 'Júpiter', color: 'white' },
        { row: 7, col: 2, planet: 'Marte', color: 'white' },
        { row: 7, col: 3, planet: 'Venus', color: 'white' },
        { row: 7, col: 4, planet: 'Mercurio', color: 'white' },
        { row: 7, col: 5, planet: 'Luna', color: 'white' },
        { row: 7, col: 6, planet: 'Sol', color: 'white' },
        { row: 7, col: 8, planet: 'Sol', color: 'white' },
        { row: 7, col: 9, planet: 'Luna', color: 'white' },
        { row: 7, col: 10, planet: 'Mercurio', color: 'white' },
        { row: 7, col: 11, planet: 'Venus', color: 'white' },
        { row: 7, col: 12, planet: 'Marte', color: 'white' },
        { row: 7, col: 13, planet: 'Júpiter', color: 'white' },
        { row: 7, col: 14, planet: 'Saturno', color: 'white' },
        
        // FILA 8
        { row: 8, col: 0, planet: 'Sol_Rojo', color: 'pink' },
        { row: 8, col: 1, planet: 'Luna_Azul', color: 'blue' },
        { row: 8, col: 2, planet: 'Mercurio_Amarillo', color: 'yellow' },
        { row: 8, col: 3, planet: 'Venus_Verde', color: 'green' },
        { row: 8, col: 4, planet: 'Marte_Rojo', color: 'pink' },
        { row: 8, col: 5, planet: 'Júpiter_Azul', color: 'blue' },
        { row: 8, col: 6, planet: 'Saturno', color: 'white' },
        { row: 8, col: 7, planet: 'Sol', color: 'white' },
        { row: 8, col: 8, planet: 'Saturno', color: 'white' },
        { row: 8, col: 9, planet: 'Sol_Verde', color: 'green' },
        { row: 8, col: 10, planet: 'Luna_Amarillo', color: 'yellow' },
        { row: 8, col: 11, planet: 'Mercurio_Verde', color: 'green' },
        { row: 8, col: 12, planet: 'Venus_Amarillo', color: 'yellow' },
        { row: 8, col: 13, planet: 'Marte_Azul', color: 'blue' },
        { row: 8, col: 14, planet: 'Júpiter_Rojo', color: 'pink' },
        
        // FILA 9
        { row: 9, col: 6, planet: 'Sol_Verde', color: 'green' },
        { row: 9, col: 7, planet: 'Luna', color: 'white' },
        { row: 9, col: 8, planet: 'Júpiter_Azul', color: 'blue' },
        
        // FILA 10
        { row: 10, col: 6, planet: 'Luna_Amarillo', color: 'yellow' },
        { row: 10, col: 7, planet: 'Mercurio', color: 'white' },
        { row: 10, col: 8, planet: 'Marte_Rojo', color: 'pink' },
        
        // FILA 11
        { row: 11, col: 6, planet: 'Mercurio_Verde', color: 'green' },
        { row: 11, col: 7, planet: 'Venus', color: 'white' },
        { row: 11, col: 8, planet: 'Venus_Verde', color: 'green' },
        
        // FILA 12
        { row: 12, col: 6, planet: 'Venus_Amarillo', color: 'yellow' },
        { row: 12, col: 7, planet: 'Marte', color: 'white' },
        { row: 12, col: 8, planet: 'Mercurio_Amarillo', color: 'yellow' },
        
        // FILA 13
        { row: 13, col: 6, planet: 'Marte_Azul', color: 'blue' },
        { row: 13, col: 7, planet: 'Júpiter', color: 'white' },
        { row: 13, col: 8, planet: 'Luna_Azul', color: 'blue' },
        
        // FILA 14
        { row: 14, col: 6, planet: 'Júpiter_Rojo', color: 'pink' },
        { row: 14, col: 7, planet: 'Saturno', color: 'white' },
        { row: 14, col: 8, planet: 'Sol_Rojo', color: 'pink' }
    ];
    
    // Añadir todos los símbolos al tablero según la configuración
    for (const symbolInfo of symbolsMap) {
        // Para las celdas que están en zonas de casa, no añadimos símbolos
        const isInHouseZone = houseZones.some(house => 
            symbolInfo.row >= house.startRow && 
            symbolInfo.row < house.startRow + house.size && 
            symbolInfo.col >= house.startCol && 
            symbolInfo.col < house.startCol + house.size
        );
        
        if (!isInHouseZone) {
            const cells = document.querySelectorAll(`.cell[data-row="${symbolInfo.row}"][data-col="${symbolInfo.col}"]`);
            
            if (cells.length > 0) {
                const cell = cells[0];
                
                // Crear el círculo con el símbolo
                const symbolDiv = document.createElement('div');
                symbolDiv.className = `symbol circle-${symbolInfo.color}`;
                
                // Obtener el símbolo Unicode para el planeta
                const symbolObj = symbols.find(s => s.name === symbolInfo.planet);
                const symbolChar = symbolObj ? symbolObj.symbol : '?';
                
                // Añadir el símbolo
                symbolDiv.textContent = symbolChar;
                
                // Añadir el círculo a la celda
                cell.appendChild(symbolDiv);
                
                // Remover la clase no-border si tiene un símbolo
                cell.classList.remove('no-border');
                
                // Actualizar el estado del juego
                const cellIndex = gameState.board.findIndex(c => c.row === symbolInfo.row && c.col === symbolInfo.col);
                if (cellIndex !== -1) {
                    gameState.board[cellIndex].hasSymbol = true;
                    gameState.board[cellIndex].symbol = symbolInfo.planet;
                    gameState.board[cellIndex].planet = symbolInfo.planet;
                    gameState.board[cellIndex].symbolColor = symbolInfo.color;
                }
            }
        }
    }
    
    // Inicializar las casas de los jugadores
    gameState.houses = [
        { row: 12, col: 12 }, // Jugador 1 (Verde)
        { row: 2, col: 12 },  // Jugador 2 (Azul)
        { row: 2, col: 2 },   // Jugador 3 (Rosa)
        { row: 12, col: 2 }   // Jugador 4 (Amarillo)
    ];

    // Añadir información sobre las zonas de cruz
    addCrossInformation();

    // Debug fin
    debug("Tablero inicializado correctamente");
}

// Añadir información de la zona de cruz a las celdas del tablero
function addCrossInformation() {
    // Actualizar la información de las celdas del tablero con las zonas de cruz específicas
    for (let i = 0; i < gameState.board.length; i++) {
        const cell = gameState.board[i];
        
        // Para cada jugador, verificar si la celda está en su zona de cruz
        for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
            const zone = playerCrossZones[playerIdx];
            
            if (zone.type === "vertical" && cell.col === zone.col && 
                cell.row >= zone.minRow && cell.row <= zone.maxRow) {
                cell.isInCross = true;
                cell.crossColor = zone.color;
                cell.inPlayerCross = playerIdx;
            } 
            else if (zone.type === "horizontal" && cell.row === zone.row && 
                cell.col >= zone.minCol && cell.col <= zone.maxCol) {
                cell.isInCross = true;
                cell.crossColor = zone.color;
                cell.inPlayerCross = playerIdx;
            }
        }
    }
}

// Resaltar los movimientos posibles
function highlightPossibleMoves() {
    // Primero limpiamos cualquier resaltado anterior
    clearHighlights();
    
    debug(`Resaltando ${gameState.possibleMoves.length} movimientos posibles`);
    
    // Primero confirmar que hay movimientos posibles
    if (gameState.possibleMoves.length === 0) {
        return;
    }
    
    // Verificar que no estemos resaltando movimientos a la cruz inadecuados
    for (const move of gameState.possibleMoves) {
        const targetCell = gameState.board.find(c => c.row === move.targetRow && c.col === move.targetCol);
        
        // Si es un movimiento a la cruz, verificar que sea válido
        if (targetCell && targetCell.isInCross) {
            // Si no es un movimiento explícitamente marcado como movimiento a cruz, ignorarlo
            if (!move.isCrossMove) {
                debug(`ADVERTENCIA: Ignorando movimiento a cruz no válido: (${move.targetRow}, ${move.targetCol})`);
                continue;
            }
            
            // Verificar que el planeta coincida con la posición
            const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
            const expectedPosition = findCrossPlanetPosition(move.crossPlanet, currentPlayerIdx, playerCrossZones);
            
            if (!expectedPosition || expectedPosition.row !== move.targetRow || expectedPosition.col !== move.targetCol) {
                debug(`ADVERTENCIA: Ignorando movimiento a cruz con planeta incorrecto: (${move.targetRow}, ${move.targetCol})`);
                continue;
            }
        }
        
        // Resaltar el movimiento válido
        const cell = document.querySelector(`.cell[data-row="${move.targetRow}"][data-col="${move.targetCol}"]`);
        if (cell) {
            cell.classList.add('highlight-move');
        }
    }
}

// Resaltar los movimientos posibles para una ficha específica
function highlightPossibleMovesForPiece(piece) {
    clearHighlights();
    
    // Filtrar solo los movimientos para la ficha seleccionada
    const pieceMoves = gameState.possibleMoves.filter(m => m.pieceId === piece.id);
    
    debug(`Resaltando ${pieceMoves.length} movimientos posibles para ficha ${piece.id}`);
    
    // Resaltar cada movimiento posible
    pieceMoves.forEach(move => {
        const targetCell = gameState.board.find(c => c.row === move.targetRow && c.col === move.targetCol);
        
        // Si es un movimiento a la cruz, verificar que sea válido
        if (targetCell && targetCell.isInCross) {
            // Si no es un movimiento a la cruz, ignorarlo
            if (!move.isCrossMove) {
                debug(`Ignorando resaltado de movimiento a cruz no válido: (${move.targetRow}, ${move.targetCol})`);
                return;
            }
            
            // Verificar que coincida con el planeta
            if (move.crossPlanet) {
                const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
                const expectedPosition = findCrossPlanetPosition(move.crossPlanet, currentPlayerIdx, playerCrossZones);
                
                if (!expectedPosition || 
                    expectedPosition.row !== move.targetRow || 
                    expectedPosition.col !== move.targetCol) {
                    debug(`Ignorando resaltado de movimiento a cruz con planeta incorrecto: (${move.targetRow}, ${move.targetCol})`);
                    return;
                }
            }
        }
        
        const cell = document.querySelector(`.cell[data-row="${move.targetRow}"][data-col="${move.targetCol}"]`);
        if (cell) {
            cell.classList.add('highlight-move');
        }
    });
}

// Función para resaltar fichas que pueden moverse
function highlightMovablePieces() {
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    debug("Resaltando fichas movibles para el jugador " + currentPlayerIdx);
    clearHighlights();
    
    // Encontrar todas las fichas del jugador actual con movimientos posibles
    const playerPieces = gameState.pieces.filter(p => 
        p.player === currentPlayerIdx && !p.inCross);
    
    debug(`Encontradas ${playerPieces.length} fichas del jugador en el tablero`);
    
    // Para cada ficha, verificar si tiene al menos un movimiento posible
    let hasMovablePieces = false;
    
    for (const piece of playerPieces) {
        const hasMoves = gameState.possibleMoves.some(m => 
            m.type === 'normal' && m.pieceId === piece.id);
        
        debug(`Ficha en (${piece.row}, ${piece.col}) tiene movimientos: ${hasMoves}`);
        
        if (hasMoves) {
            // Resaltar la celda donde está la ficha
            const cell = document.querySelector(`.cell[data-row="${piece.row}"][data-col="${piece.col}"]`);
            if (cell) {
                cell.classList.add('highlight-move');
                hasMovablePieces = true;
            }
        }
    }
    
    // Si no hay fichas movibles, mostrar un mensaje
    if (!hasMovablePieces) {
        logMessage("No hay fichas que se puedan mover. Intenta sacar una ficha de casa o pasa turno.");
        
        // Resaltar posibles movimientos desde casa si existen
        const houseMovesExist = gameState.possibleMoves.some(m => m.type === 'fromHouse');
        if (houseMovesExist) {
            for (const move of gameState.possibleMoves) {
                if (move.type === 'fromHouse') {
                    const cell = document.querySelector(`.cell[data-row="${move.targetRow}"][data-col="${move.targetCol}"]`);
                    if (cell) {
                        cell.classList.add('highlight-move');
                    }
                }
            }
        }
    }
    
    return hasMovablePieces;
}

// Mostrar información sobre las líneas del tablero
function showLineInfo() {
    logMessage('-----LÍNEAS DEL TABLERO-----');
    logMessage('Rojo_Humedo (Rosa): Columna 6, Filas 0 a 5');
    logMessage('Rojo_Seco (Rosa): Fila 6, columnas 0 a 5');
    logMessage('Amarillo_Humedo (Amarillo): Fila 8, Columnas 0 a 5');
    logMessage('Amarillo_Seco (Amarillo): Columna 6, Filas de 9 a 14');
    logMessage('Verde_Humedo (Verde): Columna 8, filas de 9 a 14');
    logMessage('Verde_Seco (Verde): Fila 8, Columnas de 9 a 14');
    logMessage('Azul_Humedo (Azul): Fila 6, Columnas de 9 a 14');
    logMessage('Azul_Seco (Azul): Columna 8, Filas de 0 a 5');
    logMessage('------------------------');
    
    // Mostrar líneas para salir de casa
    logMessage('-----LÍNEAS INICIALES POR JUGADOR-----');
    logMessage('Jugador 1 (Verde): ' + playerStartLines[0].join(', '));
    logMessage('Jugador 2 (Azul): ' + playerStartLines[1].join(', '));
    logMessage('Jugador 3 (Rosa): ' + playerStartLines[2].join(', '));
    logMessage('Jugador 4 (Amarillo): ' + playerStartLines[3].join(', '));
    logMessage('------------------------');
    
    // Mostrar reglas de adyacencia
    logMessage('-----LÍNEAS ADYACENTES-----');
    for (const [line, adjacents] of Object.entries(adjacentLines)) {
        logMessage(`${line} conecta con: ${adjacents.join(', ')}`);
    }
    
    // Mostrar restricciones
    logMessage('-----RESTRICCIONES DE MOVIMIENTO-----');
    logMessage('- Si una ficha está en Línea Húmeda de su casa, no puede moverse a Línea Seca de la casa anterior.');
    logMessage('------------------------');
    
    // Mostrar información sobre casillas seguras
    if (gameState.gameMode === 4) {
        logMessage('-----CASILLAS SEGURAS (Modo 4 jugadores)-----');
        for (let i = 0; i < 4; i++) {
            const colorName = playerInfo[i].colorName;
            logMessage(`Jugador ${i+1} (${colorName}): ${safeSpots[i].map(spot => spot.planet).join(', ')}`);
        }
        logMessage('IMPORTANTE: En las dos últimas filas antes de la cruz, NO hay casillas seguras');
        logMessage('------------------------');
    }
}
