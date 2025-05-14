import asyncio
import json
import logging
import uuid
from typing import Dict, List, Set, Optional, Any

import websockets
from websockets.server import WebSocketServerProtocol

# Configuración del logging
logging.basicConfig(
    format="%(asctime)s %(message)s",
    level=logging.INFO,
)

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
            "requiredPlayers": game_mode
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
        """Permite a un jugador unirse a un juego existente"""
        if game_id not in self.games:
            return None
        
        game = self.games[game_id]
        
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
        player_id = client.get("player_id")
        
        if game_id in self.games and player_id in self.game_connections.get(game_id, {}):
            # Marcar jugador como desconectado
            game = self.games[game_id]
            if player_id in game["players"]:
                game["players"][player_id]["connected"] = False
                game["connectedPlayers"] -= 1
                
            # Eliminar conexión
            del self.game_connections[game_id][player_id]
            
            # Si todos los jugadores se desconectaron, eliminar el juego
            if len([p for p in game["players"].values() if p["connected"]]) == 0:
                if game_id in self.available_games:
                    del self.available_games[game_id]
                if game_id in self.game_connections:
                    del self.game_connections[game_id]
                if game_id in self.games:
                    del self.games[game_id]
                logging.info(f"Juego {game_id} eliminado por desconexión de todos los jugadores")
            else:
                # Actualizar juego si sigue activo
                if game_id in self.available_games:
                    self.available_games[game_id]["connectedPlayers"] = game["connectedPlayers"]
        
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

async def handler(websocket: WebSocketServerProtocol):
    """Maneja la conexión WebSocket con un cliente"""
    try:
        async for message_str in websocket:
            try:
                message = json.loads(message_str)
                message_type = message.get("type")
                
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
                logging.error(f"Mensaje inválido: {message_str}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Formato de mensaje inválido"
                }))
    
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        game_server.remove_client(websocket)

async def main():
    # Iniciar servidor WebSocket
    host = "0.0.0.0"  # Escuchar en todas las interfaces
    port = 8765
    
    logging.info(f"Servidor iniciando en ws://{host}:{port}")
    
async with websockets.serve(
    handler, 
    host, 
    port,
    ping_interval=20,
    ping_timeout=20,
    close_timeout=15
):
    await asyncio.Future()  # Ejecutar indefinidamente
    
if __name__ == "__main__":
    asyncio.run(main())