export class GameWebSocket {
    private static instance: GameWebSocket;
    public ws: WebSocket | null = null;
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
        // Usa variable de entorno para la nube o localhost como fallback
        const url = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";
        try {
            this.ws = new WebSocket(url);
            this.ws.onopen = () => {
                console.log("Conectado de forma segura al motor autoritativo de Go");
                this.isConnected = true;
            };
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.listeners.forEach(fn => fn(data));
            };
            this.ws.onerror = () => {
                console.warn(`Go Backend no detectado en ${url}`);
                this.isConnected = false;
            };
            this.ws.onclose = () => {
                this.isConnected = false;
                // Reconnect logic could be added here
            };
        } catch (e) {
            console.error("Error inicializando WebSocket", e);
        }
    }

    public subscribe(fn: (data: any) => void) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    public send(data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

export const gameSocket = GameWebSocket.getInstance();
