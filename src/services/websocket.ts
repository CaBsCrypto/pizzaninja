import PartySocket from "partysocket";

export class GameWebSocket {
    private static instance: GameWebSocket;
    public ws: PartySocket | null = null;
    private listeners: ((data: any) => void)[] = [];
    public isConnected = false;

    private constructor() {
        this.connect();
    }

    public static getInstance(): GameWebSocket {
        if (!GameWebSocket.instance) {
            GameWebSocket.instance = new GameWebSocket();
        }
        return GameWebSocket.instance;
    }

    private connect() {
        // PartySocket auto-handles localhost (1999) vs production magically if configured,
        // or we can pass a specific host. In dev, PartyKit runs on localhost:1999.
        const host = import.meta.env.VITE_PARTYKIT_HOST || "127.0.0.1:1999";
        
        try {
            this.ws = new PartySocket({
                host: host,
                room: "slashslice-global", // Single global room for the MMO experience
            });
            
            this.ws.addEventListener("open", () => {
                console.log("Conectado al Edge Server de PartyKit");
                this.isConnected = true;
            });
            
            this.ws.addEventListener("message", (event) => {
                const data = JSON.parse(event.data);
                this.listeners.forEach(fn => fn(data));
            });
            
            this.ws.addEventListener("error", () => {
                console.warn(`PartyKit backend no detectado en ${host}`);
                this.isConnected = false;
            });
            
            this.ws.addEventListener("close", () => {
                this.isConnected = false;
            });
        } catch (e) {
            console.error("Error inicializando PartySocket", e);
        }
    }

    public subscribe(fn: (data: any) => void) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    public send(data: any) {
        // PartySocket uses OPEN from native WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

export const gameSocket = GameWebSocket.getInstance();
