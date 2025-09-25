# /opt/webapp/app.py
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Serve the /opt/webapp/static directory at /static (useful if you hit uvicorn directly)
app.mount("/static", StaticFiles(directory="static"), name="static")

# === Root (/) should serve your real SPA entry ===
@app.get("/", response_class=FileResponse)
def spa():
    return FileResponse(os.path.join("static", "index.html"))

# --- Simple WebSocket broadcast (as you had) ---
class Manager:
    def __init__(self):
        self.active = set()
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
    async def broadcast(self, text: str):
        for ws in list(self.active):
            try:
                await ws.send_text(text)
            except Exception:
                self.disconnect(ws)

manager = Manager()

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            text = await ws.receive_text()
            await manager.broadcast(text)
    except WebSocketDisconnect:
        manager.disconnect(ws)

# --- Minimal handler to satisfy index.html's POST /button-click ---
# (Your HTML uses a relative fetch to "/button-click"; we return 200 OK for now.)
@app.post("/button-click", response_class=PlainTextResponse)
async def button_click(request: Request):
    raw = await request.body()
    # TODO: parse and talk to your CAN/Teensy from here
    return "OK"
