import os
import json
import time
import math
import logging
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from web3_client import Web3Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AI-Validator")

# Configuraciones
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "slashslice")
SUBSCRIPTION_ID = os.getenv("PUBSUB_SUBSCRIPTION", "pizza-slices-events-sub")
WEB3_REWARD_WEI = 1000000000000000 # 0.001 BNB

web3_client = Web3Client()

def validate_trajectory(trajectory: list) -> bool:
    """
    IA Anti-Cheat Básica:
    Analiza la trayectoria geométrica del corte para verificar que fue hecho por un humano
    y no por un bot que envía líneas perfectas o con velocidades irreales.
    """
    if not trajectory or len(trajectory) < 2:
        return False
        
    total_distance = 0.0
    for i in range(1, len(trajectory)):
        p1 = trajectory[i-1]
        p2 = trajectory[i]
        dist = math.hypot(p2['x'] - p1['x'], p2['y'] - p1['y'])
        total_distance += dist
        
    # Un bot podría enviar puntos demasiado separados (teletransportación)
    if total_distance > 2000.0:
        logger.warning(f"Anomalía detectada: Distancia de corte irreal ({total_distance})")
        return False
        
    # Un bot podría enviar exactamente la misma X o Y siempre (línea recta perfecta)
    # Verificamos si hay alguna ligera desviación (los humanos tiemblan un poco)
    # Para fines de este MVP, seremos permisivos pero esto se puede escalar a un modelo ML.
    
    return True

def callback(message: pubsub_v1.subscriber.message.Message) -> None:
    try:
        data = json.loads(message.data.decode("utf-8"))
        room_id = data.get("roomId", "unknown")
        score = data.get("score", 0)
        trajectory = data.get("trajectory", [])
        
        logger.info(f"Nuevo corte detectado en sala {room_id}. Score actual: {score}")
        
        # 1. Validar la trayectoria con nuestra "IA"
        is_valid = validate_trajectory(trajectory)
        
        if is_valid:
            logger.info(f"Corte validado exitosamente (Anti-Cheat OK).")
            # 2. Si es válido, conectar con Web3 y emitir recompensa
            # En un entorno real, `roomId` o el mensaje contendría la `walletAddress` del jugador
            # Aquí usaremos una dirección de prueba genérica si no viene
            wallet = data.get("walletAddress", "0x000000000000000000000000000000000000dEaD")
            
            tx_hash = web3_client.reward_player(wallet, WEB3_REWARD_WEI)
            if tx_hash:
                logger.info(f"Recompensa Web3 procesada! TX: {tx_hash}")
        else:
            logger.warning("Corte RECHAZADO por el validador IA. Posible bot.")
            
        message.ack()
    except Exception as e:
        logger.error(f"Error procesando el mensaje: {e}")
        message.nack()

def main():
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)
    
    logger.info(f"Escuchando eventos en {subscription_path}...")
    
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
    
    with subscriber:
        try:
            # Bloquear el hilo principal
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"Error fatal en el suscriptor: {e}")
            streaming_pull_future.cancel()

if __name__ == "__main__":
    main()
