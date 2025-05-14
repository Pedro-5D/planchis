/**
 * utils.js - Funciones de utilidad para Planchis Online
 */

// Función de utilidad para depuración
function debug(message) {
    if (window.debugMode) {
        console.log(`[DEBUG] ${message}`);
    }
}

// Activar/desactivar modo depuración
window.debugMode = false;

// Mapear elemento a color
function mapElementToColor(element) {
    switch (element) {
        case 'Fuego': return 'red';
        case 'Agua': return 'blue';
        case 'Tierra': return 'green';
        case 'Aire': return 'yellow';
        default: return 'white';
    }
}

// Convertir color hexadecimal a RGB
function hexToRgb(hex) {
    // Remover el # si existe
    hex = hex.replace('#', '');
    
    // Convertir a RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
}

// Registrar mensaje en el log
function logMessage(message) {
    const logDiv = document.getElementById('message-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Verificar si un planeta es seguro para un jugador específico
function isPlanetSafeForPlayer(planet, playerIdx, safeSpots) {
    // Si no hay safe spots definidos para el jugador, no hay casillas seguras
    if (!safeSpots[playerIdx]) return false;
    
    // Comprobar si el planeta coincide con alguna casilla segura del jugador
    return safeSpots[playerIdx].some(spot => spot.planet === planet);
}

// Verificar si una posición está en las dos últimas filas antes de la cruz
function isInLastTwoRowsBeforeCross(row, col, playerIdx) {
    // Verde (jugador 0): filas 11 y 12 cerca de la cruz vertical
    if (playerIdx === 0) {
        return (col === 6 || col === 8) && (row === 11 || row === 12);
    }
    // Azul (jugador 1): columnas 11 y 12 cerca de la cruz horizontal
    else if (playerIdx === 1) {
        return (row === 6 || row === 8) && (col === 11 || col === 12);
    }
    // Rosa (jugador 2): filas 2 y 3 cerca de la cruz vertical
    else if (playerIdx === 2) {
        return (col === 6 || col === 8) && (row === 2 || row === 3);
    }
    // Amarillo (jugador 3): columnas 2 y 3 cerca de la cruz horizontal 
    else if (playerIdx === 3) {
        return (row === 6 || row === 8) && (col === 2 || col === 3);
    }
    return false;
}

// Verificar si dos líneas son adyacentes o la misma
function areLinesConnected(line1, line2, adjacentLines, gameState) {
    // Si es la misma línea, están conectadas
    if (line1 === line2) {
        debug(`Las líneas ${line1} y ${line2} son la misma línea`);
        return true;
    }
    
    if (!line1 || !line2) return false;
    
    // Verificar si las líneas son adyacentes según la definición explícita
    if (adjacentLines[line1] && adjacentLines[line1].includes(line2)) {
        debug(`Las líneas ${line1} y ${line2} son adyacentes según la definición de adjacentLines`);
        
        // Verificar restricciones específicas de juego
        return !isLineInSameDirection(line1, line2, gameState);
    }
    
    // Si no están en la definición explícita de adyacencias, no están conectadas
    debug(`Las líneas ${line1} y ${line2} NO están conectadas según adjacentLines`);
    return false;
}

// Verificar si un movimiento es hacia la misma dirección (movimiento restringido)
function isLineInSameDirection(line1, line2, gameState) {
    if (!line1 || !line2) return false;
    
    // Extraer información de las líneas
    const getLineInfo = (line) => {
        const color = line.includes("Rojo") ? "Rojo" : 
                     line.includes("Amarillo") ? "Amarillo" : 
                     line.includes("Verde") ? "Verde" : 
                     line.includes("Azul") ? "Azul" : "";
                     
        const type = line.includes("Humedo") ? "Humedo" : "Seco";
        
        return { color, type };
    };
    
    const line1Info = getLineInfo(line1);
    const line2Info = getLineInfo(line2);
    
    // Si son del mismo color y mismo tipo (ambas húmedas o ambas secas)
    // entonces son líneas en la misma dirección (una es posterior a la otra)
    if (line1Info.color === line2Info.color && line1Info.type === line2Info.type) {
        debug(`Las líneas ${line1} y ${line2} son del mismo color y misma orientación - Dirección prohibida`);
        return true; // Movimiento prohibido
    }
    
    // Obtener el jugador actual
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    
    // Verificar las prohibiciones específicas para cada jugador
    
    // Jugador 0 (Verde) - No puede mover de Amarillo_Seco a Verde_Humedo
    if (currentPlayerIdx === 0 && 
        line1Info.color === "Amarillo" && line1Info.type === "Seco" && 
        line2Info.color === "Verde" && line2Info.type === "Humedo") {
        debug(`PROHIBIDO (Jugador Verde): No puede mover de Amarillo_Seco a Verde_Humedo`);
        return true; // Movimiento prohibido
    }
    
    // Jugador 1 (Azul) - No puede mover de Verde_Seco a Azul_Humedo
    if (currentPlayerIdx === 1 && 
        line1Info.color === "Verde" && line1Info.type === "Seco" && 
        line2Info.color === "Azul" && line2Info.type === "Humedo") {
        debug(`PROHIBIDO (Jugador Azul): No puede mover de Verde_Seco a Azul_Humedo`);
        return true; // Movimiento prohibido
    }
    
    // Jugador 2 (Rosa) - No puede mover de Azul_Seco a Rojo_Humedo
    if (currentPlayerIdx === 2 && 
        line1Info.color === "Azul" && line1Info.type === "Seco" && 
        line2Info.color === "Rojo" && line2Info.type === "Humedo") {
        debug(`PROHIBIDO (Jugador Rosa): No puede mover de Azul_Seco a Rojo_Humedo`);
        return true; // Movimiento prohibido
    }
    
    // Jugador 3 (Amarillo) - No puede mover de Rojo_Seco a Amarillo_Humedo
    if (currentPlayerIdx === 3 && 
        line1Info.color === "Rojo" && line1Info.type === "Seco" && 
        line2Info.color === "Amarillo" && line2Info.type === "Humedo") {
        debug(`PROHIBIDO (Jugador Amarillo): No puede mover de Rojo_Seco a Amarillo_Humedo`);
        return true; // Movimiento prohibido
    }
    
    // No son del mismo color y no es una transición prohibida para el jugador actual
    return false;
}

// Encontrar la posición en la cruz para un planeta específico
function findCrossPlanetPosition(basePlanet, playerIdx, playerCrossZones) {
    const playerZone = playerCrossZones[playerIdx];
    // Planetas en orden: Júpiter, Marte, Venus, Mercurio, Luna, Sol
    const planetSymbols = ["Júpiter", "Marte", "Venus", "Mercurio", "Luna", "Sol"];
    
    // Índice del planeta en la lista
    const planetIndex = planetSymbols.indexOf(basePlanet);
    if (planetIndex === -1) {
        debug(`Planeta no encontrado: ${basePlanet}`);
        return null; // Planeta no encontrado
    }
    
    debug(`Encontrando posición para ${basePlanet} (índice ${planetIndex}) en la cruz de jugador ${playerIdx}`);
    
    // Zonas verticales (Verde y Rosa)
    if (playerZone.type === "vertical") {
        // Para Verde (abajo hacia arriba)
        if (playerIdx === 0) {
            const row = playerZone.maxRow - planetIndex;
            const position = { row, col: playerZone.col };
            debug(`Posición en cruz para ${basePlanet} (Verde): (${position.row}, ${position.col})`);
            return position;
        }
        // Para Rosa (arriba hacia abajo)
        else if (playerIdx === 2) {
            const row = playerZone.minRow + planetIndex;
            const position = { row, col: playerZone.col };
            debug(`Posición en cruz para ${basePlanet} (Rosa): (${position.row}, ${position.col})`);
            return position;
        }
    }
    // Zonas horizontales (Azul y Amarillo)
    else {
        // Para Azul (izquierda a derecha)
        if (playerIdx === 1) {
            const col = playerZone.minCol + planetIndex;
            const position = { row: playerZone.row, col };
            debug(`Posición en cruz para ${basePlanet} (Azul): (${position.row}, ${position.col})`);
            return position;
        }
        // Para Amarillo (derecha a izquierda)
        else if (playerIdx === 3) {
            const col = playerZone.maxCol - planetIndex;
            const position = { row: playerZone.row, col };
            debug(`Posición en cruz para ${basePlanet} (Amarillo): (${position.row}, ${position.col})`);
            return position;
        }
    }
    
    debug(`No se encontró posición para planeta ${basePlanet} del jugador ${playerIdx}`);
    return null;
}
