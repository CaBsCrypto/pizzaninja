import asyncio
import websockets

async def test():
    uri = "wss://slash-slice-backend-183383320200.us-east4.run.app/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
    except Exception as e:
        print(f"Error: {e}")

asyncio.get_event_loop().run_until_complete(test())
