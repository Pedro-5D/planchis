// Servidor de Planchís para juego en red local
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

// Crear servidor Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Servir el archivo HTML del juego
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Almacenar información de las partidas activas
const games = {};

// Configurar Socket.IO
io.on('connection', (socket) => {
  console.log('Nuevo jugador conectado:', socket.id);
  
  // Enviar la lista de partidas disponibles
  socket.emit('gamesList', Object.keys(games).filter(id => 
    games[id].started === false && 
    games[id].players.length < 4
  ));
  
  // Crear nueva partida
  socket.on('createGame', (config) => {
    const gameId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    games[gameId] = {
      id: gameId,
      players: [{ id: socket.id, colorIndex: 0 }], // El creador es Verde por defecto
      config: config,
      gameState: null,
      started: false
    };
    
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerIndex: 0 });
    
    // Notificar a todos que hay una nueva partida
    io.emit('gamesList', Object.keys(games).filter(id => 
      !games[id].started && games[id].players.length < 4
    ));
    
    console.log(`Partida creada: ${gameId}, Modo: ${config.gameMode} jugadores`);
  });
  
  // Unirse a una partida
  socket.on('joinGame', (gameId) => {
    const game = games[gameId];
    
    if (!game) {
      socket.emit('error', 'Partida no encontrada');
      return;
    }
    
    if (game.started) {
      socket.emit('error', 'La partida ya ha comenzado');
      return;
    }
    
    if (game.players.length >= 4) {
      socket.emit('error', 'Partida llena');
      return;
    }
    
    // Encontrar el primer color disponible
    const usedColors = game.players.map(p => p.colorIndex);
    let availableColor = 0;
    
    for (let i = 0; i < 4; i++) {
      if (!usedColors.includes(i)) {
        availableColor = i;
        break;
      }
    }
    
    // Añadir jugador con el color disponible
    game.players.push({ id: socket.id, colorIndex: availableColor });
    
    socket.join(gameId);
    socket.emit('gameJoined', { 
      gameId, 
      playerIndex: availableColor,
      players: game.players 
    });
    
    // Notificar a todos en la sala
    io.to(gameId).emit('playersUpdate', {
      players: game.players
    });
    
    console.log(`Jugador unido a partida ${gameId}: ${socket.id} (Color ${availableColor})`);
  });
  
  // Seleccionar color
  socket.on('selectColor', (data) => {
    const { gameId, colorIndex } = data;
    const game = games[gameId];
    
    if (!game || game.started) return;
    
    // Verificar si el color está disponible
    const colorTaken = game.players.some(p => p.colorIndex === colorIndex && p.id !== socket.id);
    
    if (colorTaken) {
      socket.emit('error', 'Este color ya está seleccionado');
      return;
    }
    
    // Actualizar el color del jugador
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== -1) {
      game.players[playerIndex].colorIndex = colorIndex;
      
      // Notificar a todos en la sala
      io.to(gameId).emit('colorSelected', {
        playerId: socket.id,
        colorIndex: colorIndex,
        players: game.players
      });
      
      console.log(`Jugador ${socket.id} ha seleccionado el color ${colorIndex}`);
    }
  });
  
  // Iniciar partida
  socket.on('startGame', (data) => {
    const { gameId } = data;
    const game = games[gameId];
    
    if (!game || game.started) return;
    
    // Verificar si es el creador de la partida
    if (game.players[0].id !== socket.id) {
      socket.emit('error', 'Solo el creador de la partida puede iniciarla');
      return;
    }
    
    // Verificar que hay al menos 2 jugadores
    if (game.players.length < 2) {
      socket.emit('error', 'Se necesitan al menos 2 jugadores para iniciar');
      return;
    }
    
    // Obtener los índices de los jugadores participantes
    const activePlayerIndices = game.players.map(p => p.colorIndex).sort((a, b) => a - b);
    
    // Configurar el estado inicial del juego
    game.gameState = {
      currentPlayer: 0,
      players: [],
      pieces: [],
      diceResult: null,
      selectedPiece: null,
      possibleMoves: [],
      selectionMode: false,
      gameOver: false,
      gameMode: activePlayerIndices.length,
      humanPlayers: activePlayerIndices, // Todos los colores seleccionados son humanos
      activePlayerIndices: activePlayerIndices // Usar los índices de los colores seleccionados
    };
    
    // Inicializar jugadores
    for (let i = 0; i < 4; i++) {
      if (activePlayerIndices.includes(i)) {
        game.gameState.players[i] = {
          name: `Jugador ${i+1}`,
          color: `player${i+1}`,
          colorName: ['Verde', 'Azul', 'Rosa', 'Amarillo'][i],
          piecesInHouse: 6,
          piecesInCross: 0,
          ai: false,
          bgColor: [
            'rgba(0, 176, 80, 0.2)',
            'rgba(26, 163, 255, 0.2)',
            'rgba(255, 20, 147, 0.2)',
            'rgba(255, 222, 0, 0.2)'
          ][i]
        };
      }
    }
    
    game.started = true;
    io.to(gameId).emit('gameStart', game.gameState);
    console.log(`Partida ${gameId} iniciada con ${game.players.length} jugadores`);
    
    // Actualizar lista de partidas disponibles
    io.emit('gamesList', Object.keys(games).filter(id => 
      !games[id].started && games[id].players.length < 4
    ));
  });
  
  // Acciones del juego
  socket.on('gameAction', (data) => {
    const { gameId, action, payload } = data;
    const game = games[gameId];
    
    if (!game || !game.started) return;
    
    // Encontrar el jugador
    const playerInfo = game.players.find(p => p.id === socket.id);
    if (!playerInfo) return;
    
    const playerColorIndex = playerInfo.colorIndex;
    
    // Encontrar la posición del jugador en el orden de juego
    const playerTurnIndex = game.gameState.activePlayerIndices.indexOf(playerColorIndex);
    
    // Verificar que sea el turno del jugador
    if (game.gameState.currentPlayer !== playerTurnIndex) {
      socket.emit('error', 'No es tu turno');
      return;
    }
    
    console.log(`Acción de juego en ${gameId}: ${action} por jugador ${playerColorIndex}`);
    
    // Procesar la acción según su tipo
    switch (action) {
      case 'rollDice':
        // Simular tirada de dado (resultado aleatorio)
        const randomIndex = Math.floor(Math.random() * 12); // 12 combinaciones de dado
        const planets = ['Marte_Rojo', 'Marte_Azul', 'Júpiter_Rojo', 'Júpiter_Azul', 
                       'Venus_Verde', 'Venus_Amarillo', 'Mercurio_Verde', 'Mercurio_Amarillo',
                       'Luna_Azul', 'Luna_Amarillo', 'Sol_Rojo', 'Sol_Verde'];
        const elements = ['Fuego', 'Agua', 'Fuego', 'Agua', 
                        'Tierra', 'Aire', 'Tierra', 'Aire',
                        'Agua', 'Aire', 'Fuego', 'Tierra'];
        const colors = ['red', 'blue', 'red', 'blue',
                      'green', 'yellow', 'green', 'yellow',
                      'blue', 'yellow', 'red', 'green'];
        
        const diceResult = {
          planet: planets[randomIndex],
          element: elements[randomIndex],
          color: colors[randomIndex]
        };
        
        // Enviar el resultado a todos los jugadores
        io.to(gameId).emit('diceRolled', {
          playerIndex: playerColorIndex,
          diceResult: diceResult
        });
        break;
        
      case 'movePiece':
        // Enviar el movimiento a todos los jugadores
        io.to(gameId).emit('pieceMoved', {
          playerIndex: playerColorIndex,
          pieceId: payload.pieceId,
          targetRow: payload.targetRow,
          targetCol: payload.targetCol
        });
        break;
        
      case 'placeFromHouse':
        // Colocar ficha desde casa
        // Este movimiento lo procesaremos en el cliente, similar a movePiece
        io.to(gameId).emit('pieceFromHouse', {
          playerIndex: playerColorIndex,
          targetRow: payload.targetRow,
          targetCol: payload.targetCol
        });
        break;
        
      case 'skipTurn':
        // Pasar al siguiente jugador
        game.gameState.currentPlayer = (game.gameState.currentPlayer + 1) % 
                                     game.gameState.activePlayerIndices.length;
        
        // Notificar a todos del cambio de turno
        io.to(gameId).emit('turnChanged', {
          currentPlayer: game.gameState.currentPlayer,
          playerIndex: game.gameState.activePlayerIndices[game.gameState.currentPlayer]
        });
        break;
    }
  });
  
  // Desconexión
  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    
    // Buscar si el jugador estaba en alguna partida
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Si la partida ya comenzó, notificar a los demás
        if (game.started) {
          io.to(gameId).emit('playerDisconnected', {
            playerIndex: game.players[playerIndex].colorIndex
          });
          
          // Convertir al jugador en IA o mantenerlo como desconectado
          game.players[playerIndex].disconnected = true;
        } else {
          // Si la partida no comenzó, eliminar al jugador
          game.players.splice(playerIndex, 1);
          
          // Si no quedan jugadores, eliminar la partida
          if (game.players.length === 0) {
            delete games[gameId];
          } else {
            // Notificar a los demás que un jugador se fue
            io.to(gameId).emit('playersUpdate', {
              players: game.players
            });
          }
          
          // Actualizar lista de partidas disponibles
          io.emit('gamesList', Object.keys(games).filter(id => 
            !games[id].started && games[id].players.length < 4
          ));
        }
        break;
      }
    }
  });
});

// Limpiar partidas antiguas periódicamente
setInterval(() => {
  const now = Date.now();
  for (const gameId in games) {
    // Eliminar partidas sin actividad por más de 3 horas
    if (games[gameId].lastActivity && now - games[gameId].lastActivity > 3 * 60 * 60 * 1000) {
      delete games[gameId];
      console.log(`Partida ${gameId} eliminada por inactividad`);
    }
  }
}, 30 * 60 * 1000); // Verificar cada 30 minutos

// Modificar la parte final de tu server.js
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nServidor Planchís ejecutándose en puerto ${PORT}`);
  
  // Solo mostrar IPs locales en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    console.log('\nPara jugar en ESTE ORDENADOR:');
    console.log('  http://localhost:3000');
    
    console.log('\nPara jugar desde OTROS DISPOSITIVOS:');
    
    // Mostrar IPs disponibles
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    let addressFound = false;
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  http://${net.address}:${PORT}`);
          addressFound = true;
        }
      }
    }
    
    if (!addressFound) {
      console.log('  No se encontraron direcciones de red.');
    }
  } else {
    console.log('\nServidor en modo producción');
  }
});