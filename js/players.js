/**
 * players.js - Gestión de jugadores para Planchis Online
 */

// Información de los jugadores
const playerInfo = [
    { name: 'Jugador 1', color: 'player1', colorName: 'Verde', colorHex: '#00b050', crossZone: 'green' },
    { name: 'Jugador 2', color: 'player2', colorName: 'Azul', colorHex: '#1aa3ff', crossZone: 'blue' },
    { name: 'Jugador 3', color: 'player3', colorName: 'Rosa', colorHex: '#ff1493', crossZone: 'pink' },
    { name: 'Jugador 4', color: 'player4', colorName: 'Amarillo', colorHex: '#ffde00', crossZone: 'yellow' }
];

// Configuración para modos de 2 y 4 jugadores
const gameConfigs = {
    2: [0, 2], // Verde y Rosa (opuestos)
    4: [0, 1, 2, 3] // Todos los jugadores
};

// Inicializar la interfaz de jugadores
function initializePlayerInfo() {
    const gameInfoDiv = document.getElementById('game-info');
    gameInfoDiv.innerHTML = '';
    
    // Para cada jugador activo, crear su panel de información
    for (const index of gameState.activePlayerIndices) {
        const player = gameState.players[index];
        const bgColor = player.bgColor || 'transparent';
        
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-info ${index === gameState.currentPlayer ? 'active' : ''}`;
        playerDiv.style.backgroundColor = bgColor;
        playerDiv.style.width = gameState.gameMode === 2 ? '48%' : '23%';
        
        const playerNameSpan = document.createElement('h3');
        playerNameSpan.textContent = `${player.name} (${player.colorName})`;
        
        const housesDiv = document.createElement('div');
        housesDiv.className = 'houses';
        
        // Añadir fichas en casa
        for (let i = 0; i < player.piecesInHouse; i++) {
            const housePiece = document.createElement('div');
            housePiece.className = `house-piece ${player.color}`;
            housesDiv.appendChild(housePiece);
        }
        
        playerDiv.appendChild(playerNameSpan);
        playerDiv.appendChild(housesDiv);
        gameInfoDiv.appendChild(playerDiv);
    }
}

// Inicializar estado del juego según la configuración
function initializeGameState() {
    // Reiniciar estado
    gameState.currentPlayer = 0;
    gameState.players = [];
    gameState.pieces = [];
    gameState.diceResult = null;
    gameState.selectedPiece = null;
    gameState.possibleMoves = [];
    gameState.selectionMode = false;
    gameState.gameOver = false;
    
    // Usar los jugadores activos ya configurados (no sobreescribir)
    debug(`Modo de juego ${gameState.gameMode}`);
    debug(`Índices de jugadores activos: ${gameState.activePlayerIndices.join(',')}`);
    debug(`Jugadores humanos: ${gameState.humanPlayers.join(',')}`);
    
    // Inicializar jugadores
    for (let i = 0; i < 4; i++) {
        const info = playerInfo[i];
        gameState.players[i] = {
            name: info.name,
            color: info.color,
            colorName: info.colorName,
            piecesInHouse: 6,
            piecesInCross: 0,
            ai: !gameState.humanPlayers.includes(i),
            crossZone: info.crossZone,
            bgColor: `rgba(${hexToRgb(info.colorHex)}, 0.2)`
        };
    }
    
    debug(`Juego inicializado con ${gameState.activePlayerIndices.length} jugadores, ${gameState.humanPlayers.length} humanos`);
}

// Generar el selector de jugadores basado en el modo seleccionado
function generatePlayerSelector() {
    const playerSelector = document.getElementById('player-selector');
    playerSelector.innerHTML = '';
    
    // Obtener jugadores para el modo seleccionado
    const players = gameState.activePlayerIndices || gameConfigs[gameState.gameMode];
    debug(`Generando selector para ${players.length} jugadores en modo ${gameState.gameMode}`);
    debug(`Jugadores activos: ${players.join(',')}`);
    
    // Configurar el ancho de las tarjetas según el número de jugadores
    const cardWidth = players.length === 2 ? '48%' : '48%';
    
    for (const playerIdx of players) {
        const player = playerInfo[playerIdx];
        
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.color} ${gameState.humanPlayers.includes(playerIdx) ? 'selected' : ''}`;
        playerCard.dataset.player = playerIdx;
        playerCard.style.width = cardWidth;
        
        playerCard.innerHTML = `
            <h3>${player.name} (${player.colorName})</h3>
            <div class="player-toggle">
                <input type="checkbox" id="player-human-${playerIdx}" 
                       ${gameState.humanPlayers.includes(playerIdx) ? 'checked' : ''}>
                <label for="player-human-${playerIdx}">Jugador Humano</label>
            </div>
        `;
        
        // Añadir evento de clic para seleccionar/deseleccionar
        playerCard.addEventListener('click', () => {
            const checkbox = playerCard.querySelector(`#player-human-${playerIdx}`);
            checkbox.checked = !checkbox.checked;
            
            if (checkbox.checked) {
                playerCard.classList.add('selected');
                if (!gameState.humanPlayers.includes(playerIdx)) {
                    gameState.humanPlayers.push(playerIdx);
                }
            } else {
                playerCard.classList.remove('selected');
                gameState.humanPlayers = gameState.humanPlayers.filter(p => p !== playerIdx);
            }
            debug(`Jugador ${playerIdx} seleccionado como humano: ${checkbox.checked}`);
            debug(`Jugadores humanos actuales: ${gameState.humanPlayers.join(', ')}`);
        });
        
        playerSelector.appendChild(playerCard);
    }
}

// Actualizar visualización de las casas
function updateHousesDisplay() {
    const playerInfoDivs = document.querySelectorAll('.player-info');
    
    for (let i = 0; i < gameState.activePlayerIndices.length; i++) {
        const playerIdx = gameState.activePlayerIndices[i];
        const player = gameState.players[playerIdx];
        const houseDiv = playerInfoDivs[i].querySelector('.houses');
        
        // Actualizar piezas en casa
        houseDiv.innerHTML = '';
        for (let j = 0; j < player.piecesInHouse; j++) {
            const housePiece = document.createElement('div');
            housePiece.className = `house-piece ${player.color}`;
            houseDiv.appendChild(housePiece);
        }
    }
}

// Pasar al siguiente jugador
function nextTurn() {
    debug(`Pasando al siguiente jugador desde ${gameState.currentPlayer}`);
    
    // Reiniciar estado del dado
    gameState.diceResult = null;
    gameState.possibleMoves = [];
    
    // Limpiar información del elemento
    document.getElementById('element-info').textContent = '';
    document.getElementById('dice-result').textContent = '';
    document.getElementById('dice-result').className = 'dice-result';
    
    // Actualizar indicador visual del jugador activo
    const playerInfoDivs = document.querySelectorAll('.player-info');
    playerInfoDivs[gameState.currentPlayer].classList.remove('active');
    
    // Encontrar el siguiente jugador en el orden circular
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.activePlayerIndices.length;
    
    playerInfoDivs[gameState.currentPlayer].classList.add('active');
    
    // Obtener el índice real del jugador actual
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    
    // Log
    logMessage(`Turno de ${gameState.players[currentPlayerIdx].name}.`);
    
    // Limpiar selecciones previas
    clearHighlights();
    gameState.selectionMode = false;
    gameState.selectedPiece = null;
    
    // Habilitar botón de tirar dado
    document.getElementById('roll-dice').disabled = false;
    document.getElementById('move-piece').disabled = true;
    document.getElementById('skip-turn').disabled = true;
    
    // Si es IA, jugar automáticamente después de un breve retraso
    if (gameState.players[currentPlayerIdx].ai && !gameState.gameOver) {
        setTimeout(() => {
            document.getElementById('roll-dice').click();
        }, 1000);
    }
}

// Verificar si un jugador ha ganado
function checkForWin() {
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    const currentPlayer = gameState.players[currentPlayerIdx];
    
    debug(`Verificando si el jugador ${currentPlayerIdx} ha ganado (${currentPlayer.piecesInCross}/6)`);
    
    // Verificar que tiene 6 fichas en la cruz
    if (currentPlayer.piecesInCross >= 6) {
        gameState.gameOver = true;
        logMessage(`¡${currentPlayer.name} ha ganado la partida!`);
        
        // Desactivar controles
        document.getElementById('roll-dice').disabled = true;
        document.getElementById('move-piece').disabled = true;
        document.getElementById('skip-turn').disabled = true;
        
        // Mostrar mensaje de victoria
        alert(`¡${currentPlayer.name} ha ganado la partida!`);
    }
}

// Jugar turno de IA
function playAITurn() {
    // Si no hay movimientos posibles, pasar al siguiente jugador
    if (gameState.possibleMoves.length === 0) {
        setTimeout(() => {
            nextTurn();
        }, 1000);
        return;
    }
    
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    debug(`IA jugando turno (jugador ${currentPlayerIdx})`);
    
    // Estrategia de la IA: priorizar movimientos a la cruz, luego comer, luego mover
    let selectedMove = null;
    
    // 1. Priorizar mover a la cruz
    const crossMoves = gameState.possibleMoves.filter(move => 
        move.isCrossMove === true && move.crossPlanet);
    
    if (crossMoves.length > 0) {
        // Verificar que cada movimiento a la cruz sea válido
        const validCrossMoves = crossMoves.filter(move => {
            const expectedPosition = findCrossPlanetPosition(
                move.crossPlanet, 
                currentPlayerIdx,
                playerCrossZones
            );
            
            return expectedPosition && 
                   expectedPosition.row === move.targetRow && 
                   expectedPosition.col === move.targetCol;
        });
        
        if (validCrossMoves.length > 0) {
            selectedMove = validCrossMoves[Math.floor(Math.random() * validCrossMoves.length)];
            debug(`IA seleccionó movimiento a la cruz con planeta ${selectedMove.crossPlanet}`);
        }
    }
    // 2. Priorizar comer fichas enemigas
    else {
        const capturingMoves = [];
        
        for (const move of gameState.possibleMoves) {
            // Para movimientos a la cruz, verificar que coincidan con el planeta
            if (move.isCrossMove) {
                const expectedPosition = findCrossPlanetPosition(
                    move.crossPlanet, 
                    currentPlayerIdx,
                    playerCrossZones
                );
                
                if (!expectedPosition || 
                    expectedPosition.row !== move.targetRow || 
                    expectedPosition.col !== move.targetCol) {
                    continue; // Saltar este movimiento a la cruz si no coincide
                }
            }
            
            const enemyPieceExists = gameState.pieces.some(p => 
                p.row === move.targetRow && 
                p.col === move.targetCol && 
                p.player !== currentPlayerIdx && 
                !p.inCross);
            
            // Verificar si la posición está ocupada por una ficha en casilla segura
            const targetCell = gameState.board.find(c => c.row === move.targetRow && c.col === move.targetCol);
            const isInLastTwoRows = isInLastTwoRowsBeforeCross(move.targetRow, move.targetCol, currentPlayerIdx);
            
            let isCapturable = true;
            
            if (enemyPieceExists) {
                // Encontrar la ficha enemiga
                const enemyPiece = gameState.pieces.find(p => 
                    p.row === move.targetRow && 
                    p.col === move.targetCol && 
                    p.player !== currentPlayerIdx);
                
                // Verificar si está en una casilla segura
                if (targetCell && !isInLastTwoRows) {
                    const isSafeSpot = isPlanetSafeForPlayer(targetCell.planet, enemyPiece.player, safeSpots);
                    if (isSafeSpot) {
                        isCapturable = false;
                    }
                }
            }
            
            if (enemyPieceExists && isCapturable) {
                capturingMoves.push(move);
            }
        }
        
        if (capturingMoves.length > 0) {
            selectedMove = capturingMoves[Math.floor(Math.random() * capturingMoves.length)];
            debug(`IA seleccionó movimiento para comer`);
        }
        // 3. Priorizar sacar fichas de casa
        else {
            const houseMovesExist = gameState.possibleMoves.some(m => m.type === 'fromHouse');
            
            if (houseMovesExist) {
                const houseMoves = gameState.possibleMoves.filter(m => m.type === 'fromHouse');
                selectedMove = houseMoves[Math.floor(Math.random() * houseMoves.length)];
                debug(`IA seleccionó movimiento para salir de casa`);
            }
            // 4. Mover aleatoriamente
            else {
                // Filtrar movimientos a la cruz que no coincidan con el planeta
                const validMoves = gameState.possibleMoves.filter(move => {
                    // Si es un movimiento a la cruz, verificar el planeta
                    if (move.isCrossMove) {
                        const expectedPosition = findCrossPlanetPosition(
                            move.crossPlanet, 
                            currentPlayerIdx,
                            playerCrossZones
                        );
                        
                        return expectedPosition && 
                               expectedPosition.row === move.targetRow && 
                               expectedPosition.col === move.targetCol;
                    }
                    
                    // No es movimiento a la cruz, es válido
                    return true;
                });
                
                if (validMoves.length > 0) {
                    selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                    debug(`IA seleccionó movimiento aleatorio`);
                }
            }
        }
    }
    
    // Ejecutar el movimiento seleccionado
    if (selectedMove) {
        debug(`IA ejecutando movimiento: ${JSON.stringify(selectedMove)}`);
        
        if (selectedMove.type === 'fromHouse') {
            placeNewPiece(selectedMove.targetRow, selectedMove.targetCol);
        } else {
            movePiece(selectedMove.pieceId, selectedMove.targetRow, selectedMove.targetCol);
        }
        
        // Actualizar controles
        document.getElementById('roll-dice').disabled = false;
        document.getElementById('move-piece').disabled = true;
        document.getElementById('skip-turn').disabled = true;
        
        // Limpiar resaltados
        clearHighlights();
        
        // Verificar si ha ganado
        checkForWin();
        
        // Pasar al siguiente jugador si no ha ganado
        if (!gameState.gameOver) {
            setTimeout(() => {
                nextTurn();
            }, 1000);
        }
    } else {
        // Pasar turno si no hay movimiento seleccionado
        debug(`IA no encontró movimiento válido`);
        setTimeout(() => {
            nextTurn();
        }, 1000);
    }
}

// Colocar una nueva ficha desde la casa
function placeNewPiece(row, col) {
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    const currentPlayer = gameState.players[currentPlayerIdx];
    
    debug(`Colocando nueva ficha en (${row}, ${col}) para jugador ${currentPlayerIdx}`);
    
    // Crear nueva ficha en el DOM
    const boardDiv = document.getElementById('board');
    const cellDiv = boardDiv.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    const pieceDiv = document.createElement('div');
    pieceDiv.className = `piece ${currentPlayer.color}`;
    
    const pieceId = `piece-${currentPlayer.color}-${Date.now()}`;
    pieceDiv.id = pieceId;
    
    cellDiv.appendChild(pieceDiv);
    
    // Verificar si la casilla destino es parte de la cruz
    const cell = gameState.board.find(c => c.row === row && c.col === col);
    const isInCross = cell && cell.isInCross;
    
    // Actualizar estado del juego
    const newPiece = {
        id: pieceId,
        player: currentPlayerIdx,
        row,
        col,
        inCross: isInCross
    };
    
    gameState.pieces.push(newPiece);
    
    // Actualizar estado del jugador
    currentPlayer.piecesInHouse--;
    
    if (isInCross) {
        currentPlayer.piecesInCross++;
    }
    
    // Actualizar las casas en el DOM
    updateHousesDisplay();
    
    // Comprobar si hay alguna ficha para comer
    checkForCapturing(row, col);
    
    // Log
    logMessage(`${currentPlayer.name} ha sacado una ficha de casa a la posición (${row}, ${col}).`);
}

// Mover una ficha
function movePiece(pieceId, targetRow, targetCol) {
    // Encontrar la ficha
    const pieceIndex = gameState.pieces.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) {
        debug(`Error: No se encontró la ficha con ID ${pieceId}`);
        return;
    }
    
    const piece = gameState.pieces[pieceIndex];
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    const currentPlayer = gameState.players[currentPlayerIdx];
    
    debug(`Moviendo ficha ${pieceId} de (${piece.row}, ${piece.col}) a (${targetRow}, ${targetCol})`);
    
    // Comprobar si es un movimiento a la cruz desde la posición final
    const isMoveToCross = isPositionReadyForCross(piece.row, piece.col, currentPlayerIdx) &&
                         gameState.board.find(c => c.row === targetRow && c.col === targetCol)?.isInCross;
    
    // Actualizar posición en el DOM
    const pieceDiv = document.getElementById(pieceId);
    if (!pieceDiv) {
        debug(`Error: No se encontró el elemento DOM para la ficha ${pieceId}`);
        return;
    }
    
    const oldCellDiv = document.querySelector(`[data-row="${piece.row}"][data-col="${piece.col}"]`);
    const newCellDiv = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    
    if (!oldCellDiv || !newCellDiv) {
        debug(`Error: No se encontraron las celdas para el movimiento`);
        return;
    }
    
    oldCellDiv.removeChild(pieceDiv);
    newCellDiv.appendChild(pieceDiv);
    
    // Verificar si la casilla destino es parte de la cruz
    const targetCell = gameState.board.find(c => c.row === targetRow && c.col === targetCol);
    
    // Actualizar estado del juego
    piece.row = targetRow;
    piece.col = targetCol;
    
    // Si el movimiento es a la cruz, marcar la ficha como inCross
    if (isMoveToCross) {
        piece.inCross = true;
        currentPlayer.piecesInCross++;
        debug(`Ficha ha entrado en la cruz del jugador ${currentPlayerIdx} (movimiento especial)`);
        logMessage(`${currentPlayer.name} ha colocado una ficha en su cruz (${targetRow}, ${targetCol}).`);
    } 
    // Verificar si la ficha ha llegado a la cruz por un movimiento normal
    else if (targetCell && targetCell.isInCross && !piece.inCross) {
        // Solo si es la cruz del jugador actual
        if (targetCell.crossColor === currentPlayer.crossZone) {
            piece.inCross = true;
            currentPlayer.piecesInCross++;
            debug(`Ficha ha entrado en la cruz del jugador ${currentPlayerIdx}`);
            logMessage(`${currentPlayer.name} ha colocado una ficha en su cruz (${targetRow}, ${targetCol}).`);
        }
    }
    
    // Comprobar si hay alguna ficha para comer (solo si no es un movimiento a la cruz)
    if (!isMoveToCross) {
        checkForCapturing(targetRow, targetCol);
    }
    
    // Log si no es movimiento a cruz (ya se hizo log arriba para ese caso)
    if (!isMoveToCross && (!targetCell || !targetCell.isInCross)) {
        logMessage(`${currentPlayer.name} ha movido una ficha a la posición (${targetRow}, ${targetCol}).`);
    }
}

// Comprobar si hay fichas para comer
function checkForCapturing(row, col) {
    // Si la ficha está en la cruz, no puede comer ni ser comida
    const cell = gameState.board.find(c => c.row === row && c.col === col);
    if (cell && cell.isInCross) {
        return;
    }
    
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    debug(`Comprobando si hay fichas para comer en (${row}, ${col})`);
    
    // Verificar si estamos en las dos últimas filas antes de la cruz para cada jugador
    const isInLastTwoRows = isInLastTwoRowsBeforeCross(row, col, currentPlayerIdx);
    
    // Obtener todas las fichas en esta posición que no son del jugador actual
    const pieces = gameState.pieces.filter(p => 
        p.row === row && p.col === col && 
        p.player !== currentPlayerIdx);
    
    // Verificar si alguna ficha está en una casilla segura
    let safeSpotOccupied = false;
    for (const piece of pieces) {
        const isSafeSpot = !isInLastTwoRows && isPlanetSafeForPlayer(cell.planet, piece.player, safeSpots);
        if (isSafeSpot) {
            safeSpotOccupied = true;
            debug(`Ficha de jugador ${piece.player} está en casilla segura (${cell.planet}), no puede ser comida`);
            // Si hay una ficha en casilla segura, no podemos colocar nuestra ficha aquí
            // Devolvemos inmediatamente sin hacer cambios
            return;
        }
    }
    
    // Si no hay fichas en casillas seguras, procedemos normalmente a comer las fichas
    if (pieces.length > 0 && !safeSpotOccupied) {
        debug(`Se encontraron ${pieces.length} fichas para comer`);
        
        for (const piece of pieces) {
            // Eliminar la ficha del DOM
            const pieceDiv = document.getElementById(piece.id);
            if (pieceDiv) {
                const cellDiv = pieceDiv.parentNode;
                cellDiv.removeChild(pieceDiv);
            }
            
            // Actualizar estado del jugador
            const capturedPlayer = gameState.players[piece.player];
            capturedPlayer.piecesInHouse++;
            
            // Si la ficha estaba en la cruz, actualizar contador
            if (piece.inCross) {
                capturedPlayer.piecesInCross--;
            }
            
            // Log
            logMessage(`${gameState.players[currentPlayerIdx].name} ha comido una ficha de ${capturedPlayer.name}.`);
        }
        
        // Eliminar las fichas del estado del juego
        gameState.pieces = gameState.pieces.filter(p => 
            !(p.row === row && p.col === col && p.player !== currentPlayerIdx));
        
        // Actualizar las casas en el DOM
        updateHousesDisplay();
    }
}

// Función para manejar clics en los símbolos de las casas
function handleHouseSymbolClick(playerIndex) {
    // Solo permitir seleccionar casa del jugador actual
    const currentPlayerIdx = gameState.activePlayerIndices[gameState.currentPlayer];
    if (playerIndex !== currentPlayerIdx) {
        logMessage("Solo puedes seleccionar fichas de tu propia casa.");
        return;
    }
    
    // Verificar si es el turno del jugador humano
    const currentPlayer = gameState.players[currentPlayerIdx];
    if (currentPlayer.ai) {
        return;
    }
    
    // Verificar si se ha tirado el dado
    if (!gameState.diceResult) {
        logMessage("Primero debes tirar el dado.");
        return;
    }
    
    // Verificar si hay fichas en casa
    if (currentPlayer.piecesInHouse <= 0) {
        logMessage("No tienes fichas en casa.");
        return;
    }
    
    // Verificar si hay movimientos posibles desde casa
    const fromHouseMoves = gameState.possibleMoves.filter(m => m.type === 'fromHouse');
    if (fromHouseMoves.length === 0) {
        logMessage("No hay movimientos posibles desde casa con el dado actual.");
        return;
    }
    
    // Limpiar cualquier selección previa
    clearHighlights();
    gameState.selectedPiece = null;
    
    // Resaltar los destinos posibles
    for (const move of fromHouseMoves) {
        const cell = document.querySelector(`.cell[data-row="${move.targetRow}"][data-col="${move.targetCol}"]`);
        if (cell) {
            cell.classList.add('highlight-move');
        }
    }
    
    // Indicar visualmente que se ha seleccionado la casa
    const symbolDiv = document.querySelector(`.house-symbol[data-house="${playerIndex}"]`);
    if (symbolDiv) {
        symbolDiv.classList.add('selected-house');
    }
    
    // Activar modo de casa seleccionada
    gameState.houseSelected = true;
    
    logMessage("Casa seleccionada. Haz clic en una casilla resaltada para colocar tu ficha.");
}
