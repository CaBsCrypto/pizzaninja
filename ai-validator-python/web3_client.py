import os
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Web3Client:
    def __init__(self):
        logger.warning("Operando en modo SIMULACIÓN. (Librería Web3 desactivada por falta de C++ Build Tools locales)")
        self.account = None
        self.chain_id = 97 # BNB Testnet
        
        # En producción, esto debería venir de Secret Manager
        self.private_key = os.getenv("WEB3_PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000000") # Dummy para dev local si no hay env var
        
        if self.private_key and self.private_key != "0x0000000000000000000000000000000000000000000000000000000000000000":
            try:
                self.account = self.w3.eth.account.from_key(self.private_key)
                logger.info(f"Conectado a Web3. Billetera del Agente: {self.account.address}")
            except Exception as e:
                logger.error(f"Error cargando la llave privada: {e}")
                self.account = None
        else:
            self.account = None
            logger.warning("No se proporcionó WEB3_PRIVATE_KEY válida. Operando en modo SIMULACIÓN.")

        # Simularemos una transferencia de BNB muy pequeña (o una llamada a contrato)
        self.chain_id = 97 # BNB Testnet

    def reward_player(self, player_address: str, amount_wei: int):
        logger.info(f"[SIMULACIÓN WEB3] Firmando contrato inteligente BNB Chain...")
        logger.info(f"[SIMULACIÓN WEB3] Recompensando a {player_address} con {amount_wei} wei.")
        return "0xSimulatedTransactionHash"
