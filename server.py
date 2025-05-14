import asyncio
import json
import logging
import uuid
import time
import os
from typing import Dict, List, Set, Optional, Any

import websockets
from websockets.server import WebSocketServerProtocol

# Configuración del logging
logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)

# Detección de Render
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    logging.info(f"Detectado despliegue en Render: {RENDER_EXTERNAL_HOSTNAME}")

# Almacenamiento de juegos activos y conexiones de clientes
class GameServer:
    def __init__(self):
        # Mapeo de ID de juego a estado del juego
        self.games: Dict[str, Dict[str, Any]] = {}
        # Mapeo de ID de juego a conjunto de conexiones de clientes
        self.game_connections: Dict[str, Dict[str, WebSocketServerProtocol]] = {}
        # Mapeo de conexiones a información del cliente
        self.clients: Dict[WebSocketServerProtocol, Dict[str, Any]] = {}
        # Lista de juegos disponibles para unirse
        self.available_games: Dict[str, Dict[str, Any]] = {}

    def create_game(self, host_websocket: WebSocketServerProtocol, host_name: str, game_name: str, game_mode: int) -> str:
        """Crea un nuevo juego y devuelve su ID"""
        game_id = str(uuid.uuid4())
        
        # Inicializar el estado del juego
        self.games[game_id] = {
            "gameId": game_id,
            "gameName": game_name,
            "gameMode": game_mode,  # 2 o 4 jugadores
            "host": host_name,
            "players": {
                "0": {"name": host_name, "connected": True, "isHost": True}
            },
            "gameState": {
                "currentPlayer": 0,
                "diceResult": None,
                "pieces": [],
                "gameOver": False,
                "activePlayerIndices": [0] if game_mode == 2 else [0],
                "humanPlayers": [0],
                "started": False,
                "players": []
            },
            "connectedPlayers": 1,
            "requiredPlayers": game_mode,
            "creationTime": time.time()
        }
        
        # Inicializar conexiones para este juego
        self.game_connections[game_id] = {
            "0": host_websocket
        }
        
        # Asociar cliente con este juego
        self.clients[host_websocket] = {
            "gameId": game_id,
            "playerId": "0",
            "name": host_name
        }
        
        # Añadir a juegos disponibles
        if game_mode > 1:  # Si requiere más jugadores
            self.available_games[game_id] = {
                "gameId": game_id,
                "gameName": game_name,
                "gameMode": game_mode,
                "host": host_name,
                "connectedPlayers": 1,
                "requiredPlayers": game_mode
            }
        
        logging.info(f"Juego creado: {game_id} por {host_name}, modo {game_mode} jugadores")
        return game_id

    async def join_game(self, game_id: str, websocket: WebSocketServerProtocol, player_name: str) -> Optional[str]:
        """Permite a un jugador unirse a un juego existente o reconectarse"""
        if game_id not in self.games:
            return None
        
        game = self.games[game_id]
        
        # Verificar si este jugador ya estaba en la partida (por nombre)
        existing_player_id = None
        for pid, player in game["players"].items():
            if player["name"] == player_name and not player["connected"]:
                existing_player_id = pid
                break
        
        # Si es una reconexión
        if existing_player_id:
            player_id = existing_player_id
            # Actualizar conexión
            game["players"][player_id]["connected"] = True
            game["connectedPlayers"] += 1
            
            # Limpiar marca de tiempo de desconexión si existe
            if "disconnectTime" in game:
                del game["disconnectTime"]
            
            # Actualizar conexiones y cliente
            self.game_connections[game_id][player_id] = websocket
            self.clients[websocket] = {
                "gameId": game_id,
                "playerId": player_id,
                "name": player_name
            }
            
            logging.info(f"Jugador {player_name} (ID: {player_id}) se reconectó al juego {game_id}")
            
        else:
            # Verificar si el juego está lleno
            if len(game["players"]) >= game["gameMode"]:
                return None
            
            # Verificar si el juego ya ha comenzado
            if game["gameState"]["started"]:
                return None
                
            # Asignar ID de jugador (siguiente disponible)
            player_configs = {
                2: [0, 2],  # Verde y Rosa (opuestos)
                4: [0, 1, 2, 3]  # Todos los jugadores
            }
            
            available_indices = player_configs[game["gameMode"]]
            taken_indices = [int(idx) for idx in game["players"].keys()]
            available_indices = [idx for idx in available_indices if idx not in taken_indices]
            
            player_id = str(available_indices[0]) if available_indices else None
            if player_id is None:
                return None
                
            # Añadir jugador al juego
            game["players"][player_id] = {
                "name": player_name,
                "connected": True,
                "isHost": False
            }
            
            # Actualizar conexiones y cliente
            self.game_connections[game_id][player_id] = websocket
            self.clients[websocket] = {
                "gameId": game_id,
                "playerId": player_id,
                "name": player_name
            }
            
            # Actualizar contadores
            game["connectedPlayers"] += 1
            
            # Actualizar lista de jugadores humanos y activos
            player_idx = int(player_id)
            if player_idx not in game["gameState"]["humanPlayers"]:
                game["gameState"]["humanPlayers"].append(player_idx)
            
            if player_idx not in game["gameState"]["activePlayerIndices"]:
                game["gameState"]["activePlayerIndices"].append(player_idx)
                # Ordenar índices de jugadores activos
                game["gameState"]["activePlayerIndices"].sort()
            
            # Si el juego está lleno, eliminarlo de la lista de disponibles
            if game["connectedPlayers"] >= game["requiredPlayers"]:
                if game_id in self.available_games:
                    del self.available_games[game_id]
            else:
                # Actualizar información de juego disponible
                if game_id in self.available_games:
                    self.available_games[game_id]["connectedPlayers"] = game["connectedPlayers"]
                    
            logging.info(f"Jugador {player_name} (ID: {player_id}) se unió al juego {game_id}")
        
        # Notificar a todos los jugadores sobre el nuevo participante
        await self.broadcast_game_update(game_id)
        
        return player_id

    async def start_game(self, game_id: str, websocket: WebSocketServerProtocol) -> bool:
        """Comienza un juego si el cliente es el anfitrión"""
        if game_id not in self.games:
            return False
            
        game = self.games[game_id]
        client = self.clients.get(websocket)
        
        if not client or client["gameId"] != game_id:
            return False
            
        player_id = client["playerId"]
        player = game["players"].get(player_id)
        
        if not player or not player.get("isHost", False):
            return False
            
        # Inicializar estado completo del juego
        player_info = [
            {"name": 'Jugador 1', "color": 'player1', "colorName": 'Verde', "colorHex": '#00b050', "crossZone": 'green'},
            {"name": 'Jugador 2', "color": 'player2', "colorName": 'Azul', "colorHex": '#1aa3ff', "crossZone": 'blue'},
            {"name": 'Jugador 3', "color": 'player3', "colorName": 'Rosa', "colorHex": '#ff1493', "crossZone": 'pink'},
            {"name": 'Jugador 4', "color": 'player4', "colorName": 'Amarillo', "colorHex": '#ffde00', "crossZone": 'yellow'}
        ]
        
        players_data = []
        for i in range(4):
            info = player_info[i]
            is_human = str(i) in game["players"]
            
            players_data.append({
                "name": game["players"].get(str(i), {}).get("name", info["name"]) if is_human else info["name"],
                "color": info["color"],
                "colorName": info["colorName"],
                "piecesInHouse": 6,
                "piecesInCross": 0,
                "ai": not is_human,
                "crossZone": info["crossZone"],
                "bgColor": f"rgba({self.hex_to_rgb(info['colorHex'])}, 0.2)"
            })
        
        game["gameState"]["players"] = players_data
        game["gameState"]["started"] = True
        
        # Remover de juegos disponibles si aún estaba ahí
        if game_id in self.available_games:
            del self.available_games[game_id]
            
        logging.info(f"Juego {game_id} iniciado por {client['name']}")
        
        # Notificar a todos los jugadores
        await self.broadcast_game_update(game_id)
        return True

    async def handle_game_action(self, game_id: str, player_id: str, action: Dict[str, Any]) -> bool:
        """Procesa una acción del jugador y actualiza el estado del juego"""
        if game_id not in self.games:
            return False
            
        game = self.games[game_id]
        game_state = game["gameState"]
        
        # Verificar si es el turno del jugador
        current_player_idx = game_state["activePlayerIndices"][game_state["currentPlayer"]]
        if int(player_id) != current_player_idx:
            return False
            
        # Procesar diferentes tipos de acciones
        action_type = action.get("type")
        
        if action_type == "roll_dice":
            # La lógica de tirar el dado está en el cliente
            # Solo necesitamos actualizar el estado con el resultado
            game_state["diceResult"] = action.get("diceResult")
            game_state["possibleMoves"] = action.get("possibleMoves", [])
            
        elif action_type == "move_piece":
            # Actualizar posición de la ficha
            piece_id = action.get("pieceId")
            target_row = action.get("targetRow")
            target_col = action.get("targetCol")
            
            # Actualizar la pieza en el estado
            for piece in game_state["pieces"]:
                if piece["id"] == piece_id:
                    piece["row"] = target_row
                    piece["col"] = target_col
                    # Actualizar otros atributos según la acción
                    if "inCross" in action:
                        piece["inCross"] = action["inCross"]
                    break
                    
            # Si hay capturas (piezas comidas)
            if "capturedPieces" in action:
                # Eliminar piezas capturadas
                for captured_id in action["capturedPieces"]:
                    game_state["pieces"] = [p for p in game_state["pieces"] if p["id"] != captured_id]
                
                # Actualizar piezas en casa para los jugadores afectados
                if "updatedPlayers" in action:
                    for idx, player_data in action["updatedPlayers"].items():
                        idx = int(idx)
                        if 0 <= idx < len(game_state["players"]):
                            game_state["players"][idx]["piecesInHouse"] = player_data["piecesInHouse"]
                            game_state["players"][idx]["piecesInCross"] = player_data["piecesInCross"]
        
        elif action_type == "place_new_piece":
            # Crear nueva ficha
            new_piece = {
                "id": action.get("pieceId"),
                "player": current_player_idx,
                "row": action.get("row"),
                "col": action.get("col"),
                "inCross": action.get("inCross", False)
            }
            
            game_state["pieces"].append(new_piece)
            
            # Actualizar piezas en casa
            game_state["players"][current_player_idx]["piecesInHouse"] -= 1
            
            # Si la ficha entró directamente a la cruz
            if new_piece["inCross"]:
                game_state["players"][current_player_idx]["piecesInCross"] += 1
                
            # Procesar capturas
            if "capturedPieces" in action:
                # Similar al caso de movimiento
                for captured_id in action["capturedPieces"]:
                    game_state["pieces"] = [p for p in game_state["pieces"] if p["id"] != captured_id]
                
                if "updatedPlayers" in action:
                    for idx, player_data in action["updatedPlayers"].items():
                        idx = int(idx)
                        if 0 <= idx < len(game_state["players"]):
                            game_state["players"][idx]["piecesInHouse"] = player_data["piecesInHouse"]
                            game_state["players"][idx]["piecesInCross"] = player_data["piecesInCross"]
        
        elif action_type == "next_turn":
            # Avanzar al siguiente jugador
            game_state["currentPlayer"] = (game_state["currentPlayer"] + 1) % len(game_state["activePlayerIndices"])
            game_state["diceResult"] = None
            game_state["possibleMoves"] = []
            
        elif action_type == "game_over":
            # Finalizar el juego
            game_state["gameOver"] = True
            game_state["winner"] = action.get("winner")
            
        # Notificar a todos los jugadores
        await self.broadcast_game_update(game_id)
        return True

    def remove_client(self, websocket: WebSocketServerProtocol) -> None:
        """Maneja la desconexión de un cliente"""
        if websocket not in self.clients:
            return
        
        client = self.clients[websocket]
        game_id = client.get("gameId")
        player_id = client.get("playerId")
        
        if game_id in self.games and player_id in self.game_connections.get(game_id, {}):
            # Marcar jugador como desconectado pero mantener su información
            game = self.games[game_id]
            if player_id in game["players"]:
                game["players"][player_id]["connected"] = False
                game["connectedPlayers"] -= 1
                logging.info(f"Jugador {client.get('name', 'Desconocido')} (ID: {player_id}) se desconectó de la partida {game_id}")
            
            # Eliminar conexión
            del self.game_connections[game_id][player_id]
            
            # Si la partida ya ha empezado, mantenerla activa por un tiempo
            if game["gameState"]["started"]:
                # Añadimos un tiempo de gracia para reconexión (5 minutos)
                game["disconnectTime"] = time.time() + 300  # 5 minutos
                logging.info(f"La partida {game_id} se mantendrá activa durante 5 minutos para reconexión")
            else:
                # Si todos los jugadores se desconectaron, eliminar el juego después de un tiempo
                if len([p for p in game["players"].values() if p["connected"]]) == 0:
                    if game_id in self.available_games:
                        del self.available_games[game_id]
                    # No eliminamos el juego inmediatamente para permitir reconexiones
                    game["disconnectTime"] = time.time() + 300  # 5 minutos
                    logging.info(f"Todos los jugadores se han desconectado de la partida {game_id}, se eliminará en 5 minutos si no hay reconexiones")
        
        # Eliminar cliente
        if websocket in self.clients:
            del self.clients[websocket]
            
        logging.info(f"Cliente desconectado: {client.get('name', 'Desconocido')}")

    async def broadcast_game_update(self, game_id: str) -> None:
        """Envía actualizaciones del estado del juego a todos los jugadores conectados"""
        if game_id not in self.games or game_id not in self.game_connections:
            return
            
        game = self.games[game_id]
        connections = self.game_connections[game_id]
        
        # Preparar mensaje con el estado actual
        message = {
            "type": "game_update",
            "game": game
        }
        
        # Enviar a todos los jugadores conectados
        message_str = json.dumps(message)
        await asyncio.gather(
            *[conn.send(message_str) for conn in connections.values()],
            return_exceptions=True
        )

    async def get_available_games(self) -> List[Dict[str, Any]]:
        """Devuelve la lista de juegos disponibles para unirse"""
        return list(self.available_games.values())

    def hex_to_rgb(self, hex_color: str) -> str:
        """Convierte color hexadecimal a RGB"""
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return f"{r}, {g}, {b}"

# Instancia global del servidor de juegos
game_server = GameServer()

# Función para procesar solicitudes HTTP
async def process_request(path, headers):
    """Procesar solicitudes HTTP con soporte CORS completo"""
    if "upgrade" in headers.get("connection", "").lower() and "websocket" in headers.get("upgrade", "").lower():
        # Esta es una solicitud de actualización de WebSocket, permitir que continúe
        return None
    
    # Cabeceras CORS comunes para todas las respuestas
    cors_headers = [
        ('Access-Control-Allow-Origin', '*'),
        ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization'),
    ]
    
    # Manejar preflight OPTIONS
    if path == '*' and headers.get("access-control-request-method"):
        return (200, cors_headers, b'')
        
    if path == '/':
        return (200, [
            ('Content-Type', 'text/html'),
            *cors_headers
        ], b'<html><body><h1>Servidor de WebSocket de Planchis Online</h1><p>Esta es la API WebSocket para el juego Planchis Online. Visita <a href="https://planchis.onrender.com">planchis.onrender.com</a> para jugar.</p></body></html>')
    
    if path == '/health' or path == '/healthz':
        return (200, [('Content-Type', 'text/plain'), *cors_headers], b'OK')
    
    if path == '/status':
        status_data = {
            "status": "ok",
            "games": len(game_server.games),
            "clients": len(game_server.clients),
            "available_games": len(game_server.available_games),
            "timestamp": time.time()
        }
        return (200, [('Content-Type', 'application/json'), *cors_headers], json.dumps(status_data).encode())
        
    return (404, [('Content-Type', 'text/plain'), *cors_headers], b'Not Found')

# Tarea de limpieza periódica
async def cleanup_games():
    """Limpia juegos abandonados periódicamente de manera más eficiente"""
    cleanup_interval = 30  # Segundos entre limpiezas
    
    while True:
        try:
            current_time = time.time()
            games_to_remove = []
            games_to_update = []
            
            # Revisar cada juego
            for game_id, game in game_server.games.items():
                # Caso 1: Juego con tiempo de desconexión expirado
                if "disconnectTime" in game and current_time > game["disconnectTime"]:
                    games_to_remove.append(game_id)
                    continue
                
                # Caso 2: Juego muy antiguo (24 horas)
                if current_time - game.get("creationTime", current_time) > 86400:
                    games_to_remove.append(game_id)
                    continue
                
                # Caso 3: Juegos sin actividad reciente (3 horas)
                last_activity = game.get("lastActivityTime", game.get("creationTime", current_time))
                if current_time - last_activity > 10800:  # 3 horas
                    games_to_remove.append(game_id)
                    continue
                
                # Caso 4: Juegos disponibles pero sin jugadores conectados
                if game_id in game_server.available_games and game["connectedPlayers"] == 0:
                    if "emptyTime" not in game:
                        game["emptyTime"] = current_time
                        games_to_update.append(game_id)
                    elif current_time - game["emptyTime"] > 300:  # 5 minutos
                        games_to_remove.append(game_id)
                # Juego con jugadores, eliminar marca de tiempo de juego vacío
                elif "emptyTime" in game:
                    del game["emptyTime"]
                    games_to_update.append(game_id)
            
            # Procesar juegos a eliminar
            if games_to_remove:
                logging.info(f"Eliminando {len(games_to_remove)} juegos inactivos")
                
                for game_id in games_to_remove:
                    if game_id in game_server.games:
                        if "gameName" in game_server.games[game_id]:
                            logging.info(f"Eliminando juego: {game_id} - {game_server.games[game_id]['gameName']}")
                        else:
                            logging.info(f"Eliminando juego: {game_id}")
                        del game_server.games[game_id]
                    if game_id in game_server.game_connections:
                        del game_server.game_connections[game_id]
                    if game_id in game_server.available_games:
                        del game_server.available_games[game_id]
            
            # Limpiar conexiones huérfanas
            orphaned_connections = []
            for conn, client in game_server.clients.items():
                game_id = client.get("gameId")
                if game_id not in game_server.games:
                    orphaned_connections.append(conn)
            
            if orphaned_connections:
                logging.info(f"Eliminando {len(orphaned_connections)} conexiones huérfanas")
                for conn in orphaned_connections:
                    try:
                        del game_server.clients[conn]
                        await conn.close(1001, "Juego eliminado")
                    except:
                        pass
            
            # Esperar antes de la próxima limpieza
            await asyncio.sleep(cleanup_interval)
        except Exception as e:
            logging.error(f"Error en tarea de limpieza: {str(e)}")
            await asyncio.sleep(cleanup_interval)  # Esperar y reintentar

def optimize_memory(self):
    """Optimiza el uso de memoria limitando estados de juego antiguos"""
    max_games = 100  # Número máximo de juegos a mantener
    max_game_history = 10  # Número máximo de acciones en historial
    
    # Limitar número total de juegos
    if len(self.games) > max_games:
        # Ordenar juegos por última actividad
        game_ids = list(self.games.keys())
        game_ids.sort(key=lambda gid: self.games[gid].get("lastActivityTime", 0))
        
        # Eliminar los juegos más antiguos
        games_to_remove = game_ids[:len(game_ids) - max_games]
        for game_id in games_to_remove:
            if game_id in self.games:
                logging.info(f"Eliminando juego antiguo por límite de memoria: {game_id}")
                del self.games[game_id]
            if game_id in self.game_connections:
                del self.game_connections[game_id]
            if game_id in self.available_games:
                del self.available_games[game_id]
    
    # Limitar historial de acciones por juego
    for game_id, game in self.games.items():
        if "actionHistory" in game and len(game["actionHistory"]) > max_game_history:
            # Mantener solo las acciones más recientes
            game["actionHistory"] = game["actionHistory"][-max_game_history:]
            
    # Registrar uso de memoria aproximado
    total_games = len(self.games)
    total_connections = len(self.clients)
    logging.info(f"Estado de memoria: {total_games} juegos, {total_connections} conexiones")

async def websocket_handler(websocket: WebSocketServerProtocol):
    """Maneja la conexión WebSocket con un cliente de manera robusta"""
    # Obtener información del cliente para logs
    client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}" if hasattr(websocket, 'remote_address') else "desconocido"
    logging.info(f"Nueva conexión WebSocket desde {client_info}")
    
    # Contador de reconexiones para este cliente
    reconnect_attempts = 0
    max_reconnect_attempts = 5
    
    try:
        async for message_str in websocket:
            try:
                # Reiniciar contador de reconexiones al recibir mensajes correctamente
                reconnect_attempts = 0
                
                logging.debug(f"Mensaje recibido de {client_info} ({len(message_str)} bytes)")
                message = json.loads(message_str)
                message_type = message.get("type")
                
                if message_type == "ping":
                    # Responder a pings para mantener la conexión activa
                    # Incluir el timestamp original para medir latencia en el cliente
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "clientTime": message.get("timestamp", time.time()),
                        "serverTime": time.time()
                    }))
                    continue
                
                logging.info(f"Procesando mensaje de tipo: {message_type}")
                
                # Resto del código de manejo de mensajes...
                # [Mantener el código existente para los diferentes tipos de mensajes]
                
                if message_type == "create_game":
                    # Crear un nuevo juego
                    host_name = message.get("hostName", "Anfitrión")
                    game_name = message.get("gameName", f"Partida de {host_name}")
                    game_mode = message.get("gameMode", 2)
                    
                    game_id = game_server.create_game(websocket, host_name, game_name, game_mode)
                    
                    # Enviar confirmación
                    await websocket.send(json.dumps({
                        "type": "game_created",
                        "gameId": game_id,
                        "playerId": "0"  # El creador siempre es el jugador 0
                    }))
                
                elif message_type == "join_game":
                    # Unirse a un juego existente
                    game_id = message.get("gameId")
                    player_name = message.get("playerName", "Jugador")
                    
                    player_id = await game_server.join_game(game_id, websocket, player_name)
                    
                    if player_id:
                        # Enviar confirmación
                        await websocket.send(json.dumps({
                            "type": "game_joined",
                            "gameId": game_id,
                            "playerId": player_id
                        }))
                    else:
                        # Enviar error
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "No se pudo unir al juego"
                        }))
                
                elif message_type == "start_game":
                    # Iniciar un juego
                    game_id = message.get("gameId")
                    success = await game_server.start_game(game_id, websocket)
                    
                    if not success:
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "No se pudo iniciar el juego"
                        }))
                
                elif message_type == "game_action":
                    # Procesar acción del juego
                    game_id = message.get("gameId")
                    player_id = message.get("playerId")
                    action = message.get("action", {})
                    
                    success = await game_server.handle_game_action(game_id, player_id, action)
                    
                    if not success:
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "Acción no válida"
                        }))
                
                elif message_type == "get_available_games":
                    # Listar juegos disponibles
                    games = await game_server.get_available_games()
                    
                    await websocket.send(json.dumps({
                        "type": "available_games",
                        "games": games
                    }))
                    
            except json.JSONDecodeError:
                logging.error(f"Mensaje inválido JSON: {message_str[:100]}...")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Formato de mensaje inválido"
                }))
            except websockets.exceptions.ConnectionClosed:
                # Reconexión en progreso, salir del bucle de mensajes
                raise
            except Exception as e:
                logging.error(f"Error procesando mensaje: {str(e)}")
                # Intentar enviar mensaje de error, pero no fallar si no es posible
                try:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"Error en el servidor: {str(e)}"
                    }))
                except:
                    pass
    
    except websockets.exceptions.ConnectionClosed as e:
        reconnect_attempts += 1
        wait_time = min(5 * reconnect_attempts, 30)  # Espera creciente, máximo 30 segundos
        
        logging.info(f"Conexión cerrada desde {client_info}: código {e.code}, razón: {e.reason}, intento {reconnect_attempts}/{max_reconnect_attempts}")
        
        # Mantener el jugador en el juego por un tiempo para permitir reconexión
        client = game_server.clients.get(websocket)
        if client:
            game_id = client.get("gameId")
            player_id = client.get("playerId")
            if game_id and player_id and game_id in game_server.games:
                logging.info(f"Manteniendo slot para jugador {player_id} en juego {game_id} durante {wait_time} segundos")
                
                # No eliminar inmediatamente el cliente, dar tiempo para reconexión
                # Esta lógica se complementa con la de remove_client
        
        # No eliminar cliente automáticamente, dejar que el sistema de limpieza lo haga después de un tiempo
    except Exception as e:
        logging.error(f"Error inesperado con cliente {client_info}: {str(e)}")
    finally:
        logging.info(f"Finalizando conexión con {client_info}")
        game_server.remove_client(websocket)

async def main():
    """Función principal que inicia el servidor con configuración optimizada"""
    # Usar variables de entorno si están disponibles (para Render)
    host = "0.0.0.0"  # Escuchar en todas las interfaces
    port = int(os.environ.get('PORT', 10000))
    
    logging.info(f"Servidor iniciando en {host}:{port}")
    
    # Iniciar tarea de limpieza
    cleanup_task = asyncio.create_task(cleanup_games())
    
    try:
        # Configuración optimizada del servidor websocket
        server = await websockets.serve(
            websocket_handler, 
            host, 
            port,
            process_request=process_request,
            # Configuración mejorada para conexiones estables:
            ping_interval=30,  # Enviar ping cada 30 segundos
            ping_timeout=10,   # Esperar 10 segundos por un pong
            close_timeout=10,  # Esperar 10 segundos al cerrar
            max_size=10*1024*1024,  # 10MB max para mensajes
            # Habilitar compresión para reducir consumo de ancho de banda
            compression=None,
            # Aumentar el límite de conexiones
            max_queue=128
        )
        
        logging.info(f"Servidor WebSocket activo en {host}:{port}")
        if RENDER_EXTERNAL_HOSTNAME:
            logging.info(f"URL externa: wss://{RENDER_EXTERNAL_HOSTNAME}")
        
        # Esta es la clave para mantener el servidor corriendo
        await server.wait_closed()
    except Exception as e:
        logging.error(f"Error iniciando servidor: {str(e)}")
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Servidor detenido por usuario")
    except Exception as e:
        logging.error(f"Error fatal: {str(e)}")