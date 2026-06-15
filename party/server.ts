import type * as Party from "partykit/server";

interface PlayerState {
  id: string;
  score: number;
  combo: number;
  x: number;
  y: number;
  isSlicing: boolean;
  wallet?: string;
  lastUpdate: number;
}

export default class SlashSliceServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  players: Map<string, PlayerState> = new Map();

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A connection just joined!
    console.log(`[partykit] Player connected: ${conn.id}`);
    
    // Send them the current state of all players
    conn.send(JSON.stringify({
      type: "sync_state",
      players: Array.from(this.players.values())
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      if (data.type === "player_update") {
        // Player is broadcasting their state (coordinates, score, etc.)
        this.players.set(sender.id, {
          id: sender.id,
          score: data.score || 0,
          combo: data.combo || 1,
          x: data.x || 0,
          y: data.y || 0,
          isSlicing: data.isSlicing || false,
          wallet: data.wallet,
          lastUpdate: Date.now()
        });

        // Broadcast to everyone EXCEPT the sender
        this.room.broadcast(JSON.stringify({
          type: "player_moved",
          player: this.players.get(sender.id)
        }), [sender.id]);

      } else if (data.type === "player_slash") {
        // Player executed a specific slash
        this.room.broadcast(JSON.stringify({
          type: "player_slash_event",
          playerId: sender.id,
          x: data.x,
          y: data.y
        }), [sender.id]);
      }
    } catch (e) {
      console.error("Invalid message format", e);
    }
  }

  onClose(connection: Party.Connection) {
    console.log(`[partykit] Player disconnected: ${connection.id}`);
    this.players.delete(connection.id);
    this.room.broadcast(JSON.stringify({
      type: "player_disconnected",
      playerId: connection.id
    }));
  }
}
