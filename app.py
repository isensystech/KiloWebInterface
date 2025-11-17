import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import random
import threading
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles


LOGGER = logging.getLogger("kilo.app")
DEFAULT_BIND = "0.0.0.0:5000"
TRUTHY_VALUES = {"1", "true", "yes", "on"}
VALID_JOYSTICK_MODES = {"springy", "sticky", "pilot-hold"}

# -----------------------------------------------------------------------------
# Session / authentication settings
# -----------------------------------------------------------------------------
SESSION_COOKIE_NAME = "kilo_session"
SESSION_SECRET = os.environ.get("KILO_SESSION_SECRET", "dev-secret-key")
SESSION_COOKIE_SECURE = os.environ.get("KILO_SESSION_SECURE", "0").lower() in TRUTHY_VALUES
SESSION_COOKIE_SAMESITE = os.environ.get("KILO_SESSION_SAMESITE", "lax")
SESSION_TIMEOUT_SECONDS = int(os.environ.get("KILO_SESSION_TIMEOUT", 60 * 60 * 8))
LOGIN_PIN = os.environ.get("KILO_LOGIN_PIN", "0000")

# -----------------------------------------------------------------------------
# Control channel compatibility settings
# -----------------------------------------------------------------------------
CONTROL_TOKEN = os.environ.get("KILO_CONTROL_TOKEN")
ALLOW_ANON_CONTROL_WS = os.environ.get("KILO_ALLOW_ANON_CONTROL_WS", "0").lower() in TRUTHY_VALUES
CONTROL_WHITELIST = {
    entry.strip()
    for entry in os.environ.get("KILO_CONTROL_WHITELIST", "").split(",")
    if entry.strip()
}

# -----------------------------------------------------------------------------
# Screensaver / ROS settings
# -----------------------------------------------------------------------------
SCREENSAVER_TOPIC = os.environ.get("KILO_SCREENSAVER_TOPIC", "/kilo/screensaver")
ENABLE_FAKE_SCREENSAVER = os.environ.get("KILO_FAKE_SCREENSAVER", "0").lower() in {"1", "true", "yes"}

# -----------------------------------------------------------------------------
# Utility helpers
# -----------------------------------------------------------------------------


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(value: str) -> str:
    digest = hmac.new(SESSION_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def encode_session_cookie(data: Dict[str, Any]) -> str:
    payload = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = _b64encode(payload)
    signature = _sign(body)
    return f"{body}.{signature}"


def decode_session_cookie(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        body, signature = raw.split(".", 1)
    except ValueError:
        return {}
    if not hmac.compare_digest(_sign(body), signature):
        return {}
    try:
        data = json.loads(_b64decode(body))
        if isinstance(data, dict):
            return data
    except Exception:
        LOGGER.warning("Failed to decode session cookie payload")
    return {}


def now_ts() -> int:
    return int(time.time())


def session_is_expired(data: Dict[str, Any]) -> bool:
    if not data.get("authenticated"):
        return False
    login_at = data.get("login_at")
    if not login_at:
        return False
    try:
        return now_ts() - int(login_at) > SESSION_TIMEOUT_SECONDS
    except (TypeError, ValueError):
        return True


def session_status(data: Dict[str, Any]) -> Dict[str, bool]:
    return {
        "authenticated": bool(data.get("authenticated")),
        "legal_ack": bool(data.get("legal_ack")),
        "joystick_prefs": sanitize_joystick_prefs(data.get("joystick_prefs")) or None,
    }


def normalize_joystick_mode(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("_", "-")
    return normalized if normalized in VALID_JOYSTICK_MODES else None


def sanitize_joystick_prefs(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    throttle = normalize_joystick_mode(raw.get("throttle"))
    steering = normalize_joystick_mode(raw.get("steering"))
    data: Dict[str, str] = {}
    if throttle:
        data["throttle"] = throttle
    if steering:
        data["steering"] = steering
    return data


def is_fully_authorized(data: Dict[str, Any]) -> bool:
    return bool(data.get("authenticated") and data.get("legal_ack") and not session_is_expired(data))


class SessionContext:
    """Session helper for HTTP routes so we can set/delete cookies."""

    def __init__(self, raw_cookie: Optional[str]):
        self._data = decode_session_cookie(raw_cookie)
        self._dirty = False

    @property
    def data(self) -> Dict[str, Any]:
        return self._data

    def ensure_fresh(self) -> None:
        if session_is_expired(self._data):
            self.clear()

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._dirty = True

    def update(self, **kwargs: Any) -> None:
        if kwargs:
            self._data.update(kwargs)
            self._dirty = True

    def clear(self) -> None:
        if self._data:
            self._data = {}
        self._dirty = True

    def write_to_response(self, response: Response) -> Response:
        if not self._dirty:
            return response
        if self._data:
            response.set_cookie(
                SESSION_COOKIE_NAME,
                encode_session_cookie(self._data),
                max_age=SESSION_TIMEOUT_SECONDS,
                httponly=True,
                secure=SESSION_COOKIE_SECURE,
                samesite=SESSION_COOKIE_SAMESITE,
                path="/",
            )
        else:
            response.delete_cookie(SESSION_COOKIE_NAME, path="/")
        return response


def get_session_ctx(request: Request) -> SessionContext:
    ctx = getattr(request.state, "_session_ctx", None)
    if ctx is None:
        ctx = SessionContext(request.cookies.get(SESSION_COOKIE_NAME))
        setattr(request.state, "_session_ctx", ctx)
    return ctx


def unauthorized_response(ctx: SessionContext, detail: str, code: int = status.HTTP_401_UNAUTHORIZED) -> Response:
    response = JSONResponse({"detail": detail}, status_code=code)
    return ctx.write_to_response(response)


def session_from_websocket(ws: WebSocket) -> Dict[str, Any]:
    data = decode_session_cookie(ws.cookies.get(SESSION_COOKIE_NAME))
    if session_is_expired(data):
        return {}
    return data


def websocket_is_authorized(ws: WebSocket, session_data: Dict[str, Any]) -> bool:
    if is_fully_authorized(session_data):
        return True
    client_ip = getattr(ws.client, "host", None)
    if client_ip and client_ip in CONTROL_WHITELIST:
        return True
    if not CONTROL_TOKEN:
        return ALLOW_ANON_CONTROL_WS
    token = ws.query_params.get("token") or ws.headers.get("X-Kilo-Control-Token")
    if token and hmac.compare_digest(token, CONTROL_TOKEN):
        return True
    return ALLOW_ANON_CONTROL_WS


# -----------------------------------------------------------------------------
# WebSocket managers
# -----------------------------------------------------------------------------


class ControlManager:
    def __init__(self) -> None:
        self.active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)

    async def broadcast(self, text: str) -> None:
        for ws in list(self.active):
            try:
                await ws.send_text(text)
            except Exception:
                self.disconnect(ws)


class ScreensaverManager:
    def __init__(self) -> None:
        self.active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        message = json.dumps(payload)
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)


manager = ControlManager()
screensaver_manager = ScreensaverManager()
screensaver_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
EVENT_LOOP: Optional[asyncio.AbstractEventLoop] = None


async def screensaver_broadcast_worker() -> None:
    while True:
        payload = await screensaver_queue.get()
        await screensaver_manager.broadcast(payload)


def queue_screensaver_payload(payload: Dict[str, Any]) -> None:
    if not EVENT_LOOP:
        return
    asyncio.run_coroutine_threadsafe(screensaver_queue.put(payload), EVENT_LOOP)


async def fake_screensaver_loop() -> None:
    LOGGER.info("Starting fake screensaver metrics publisher")
    while True:
        payload = {
            "type": "screensaver",
            "engine_battery": round(random.uniform(11.8, 14.2), 1),
            "fuel_level": round(random.uniform(0, 100), 1),
        }
        await screensaver_queue.put(payload)
        await asyncio.sleep(5)


def start_ros_screensaver_listener() -> None:
    try:
        import rospy  # type: ignore
        from std_msgs.msg import String  # type: ignore
    except ImportError:
        LOGGER.info("ROS not available; skipping screensaver subscriber")
        return

    def _thread_target() -> None:
        try:
            rospy.init_node("kilo_screensaver_bridge", anonymous=True, disable_signals=True)
        except rospy.exceptions.ROSException:
            # Already initialized in this process.
            pass

        def _callback(msg: String) -> None:  # type: ignore
            try:
                data = json.loads(msg.data)
            except Exception:
                LOGGER.warning("Failed to deserialize screensaver ROS payload")
                return
            if not isinstance(data, dict):
                return
            if data.get("type") != "screensaver":
                return
            queue_screensaver_payload(data)

        rospy.Subscriber(SCREENSAVER_TOPIC, String, _callback)  # type: ignore
        LOGGER.info("Subscribed to ROS screensaver topic %s", SCREENSAVER_TOPIC)
        rospy.spin()

    threading.Thread(target=_thread_target, daemon=True).start()


# -----------------------------------------------------------------------------
# FastAPI app setup
# -----------------------------------------------------------------------------

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
async def handle_startup() -> None:
    global EVENT_LOOP
    EVENT_LOOP = asyncio.get_running_loop()
    asyncio.create_task(screensaver_broadcast_worker())
    if ENABLE_FAKE_SCREENSAVER:
        asyncio.create_task(fake_screensaver_loop())
    start_ros_screensaver_listener()


@app.get("/", response_class=FileResponse)
def spa() -> FileResponse:
    return FileResponse(os.path.join("static", "index.html"))


# -----------------------------------------------------------------------------
# API routes
# -----------------------------------------------------------------------------


@app.get("/api/session")
async def api_session(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.ensure_fresh()
    response = JSONResponse(session_status(session_ctx.data))
    return session_ctx.write_to_response(response)


@app.post("/api/login")
async def api_login(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.ensure_fresh()
    payload = await request.json()
    pin = str(payload.get("pin", "")).strip()
    if not pin:
        return unauthorized_response(session_ctx, "PIN is required")
    if pin != LOGIN_PIN:
        LOGGER.warning("Invalid PIN attempt from client")
        session_ctx.clear()
        return unauthorized_response(session_ctx, "Invalid PIN")

    session_ctx.update(authenticated=True, legal_ack=False, login_at=now_ts())
    response = JSONResponse(session_status(session_ctx.data))
    return session_ctx.write_to_response(response)


@app.post("/api/legal-ack")
async def api_legal_ack(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.ensure_fresh()
    if not session_ctx.get("authenticated"):
        session_ctx.clear()
        return unauthorized_response(session_ctx, "Authentication required")

    session_ctx.set("legal_ack", True)
    response = JSONResponse(session_status(session_ctx.data))
    return session_ctx.write_to_response(response)


@app.post("/api/joystick-prefs")
async def api_joystick_prefs(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.ensure_fresh()
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"detail": "Invalid JSON payload"}, status_code=status.HTTP_400_BAD_REQUEST)

    sanitized = sanitize_joystick_prefs(payload)
    if not sanitized:
        return JSONResponse({"detail": "No valid joystick preferences supplied"}, status_code=status.HTTP_400_BAD_REQUEST)

    existing = sanitize_joystick_prefs(session_ctx.get("joystick_prefs"))
    existing.update(sanitized)
    session_ctx.set("joystick_prefs", existing)
    response = JSONResponse({"joystick_prefs": existing})
    return session_ctx.write_to_response(response)


@app.post("/button-click")
async def button_click(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.ensure_fresh()
    if not is_fully_authorized(session_ctx.data):
        session_ctx.clear()
        return unauthorized_response(session_ctx, "Legal acknowledgement required", code=status.HTTP_403_FORBIDDEN)

    await request.body()  # Placeholder for future parsing
    response = PlainTextResponse("OK")
    return session_ctx.write_to_response(response)


@app.post("/api/logout")
async def api_logout(request: Request) -> Response:
    session_ctx = get_session_ctx(request)
    session_ctx.clear()
    response = JSONResponse(session_status(session_ctx.data))
    return session_ctx.write_to_response(response)


# -----------------------------------------------------------------------------
# WebSocket endpoints
# -----------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    session_data = session_from_websocket(ws)
    if not websocket_is_authorized(ws, session_data):
        await ws.close(code=1008, reason="Authentication required")
        return

    await manager.connect(ws)
    try:
        while True:
            text = await ws.receive_text()
            if session_is_expired(session_data):
                await ws.close(code=1011, reason="Session expired")
                break
            await manager.broadcast(text)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
        raise


@app.websocket("/ws/screensaver")
async def websocket_screensaver(ws: WebSocket) -> None:
    await screensaver_manager.connect(ws)
    try:
        while True:
            try:
                await ws.receive_text()
                await ws.close(code=1003, reason="Screensaver feed is broadcast-only")
                break
            except WebSocketDisconnect:
                break
    finally:
        screensaver_manager.disconnect(ws)


# -----------------------------------------------------------------------------
# CLI helpers
# -----------------------------------------------------------------------------

def _parse_bind_target(raw: str) -> Tuple[str, int]:
    target = (raw or "").strip()
    if not target:
        return "0.0.0.0", 5000
    if ":" not in target:
        return target, 5000
    host_part, port_part = target.rsplit(":", 1)
    host = host_part or "0.0.0.0"
    try:
        port = int(port_part)
    except ValueError as exc:
        raise SystemExit(f"Invalid port value in KILO_BIND: {port_part!r}") from exc
    if not (0 < port < 65536):
        raise SystemExit(f"Invalid port value in KILO_BIND: {port}")
    return host, port


def main() -> None:
    try:
        import uvicorn
    except ImportError as exc:
        raise SystemExit(
            "Uvicorn is required to run the server. Install dependencies with "
            "`pip install fastapi uvicorn`."
        ) from exc

    bind = os.environ.get("KILO_BIND", DEFAULT_BIND)
    host, port = _parse_bind_target(bind)
    log_level = os.environ.get("KILO_LOG_LEVEL", "info")
    reload_enabled = os.environ.get("KILO_RELOAD", "").lower() in TRUTHY_VALUES
    target = "app:app" if reload_enabled else app

    LOGGER.info("Starting Kilo UI server at %s:%s (reload=%s)", host, port, reload_enabled)
    uvicorn.run(
        target,
        host=host,
        port=port,
        log_level=log_level,
        reload=reload_enabled,
    )


if __name__ == "__main__":
    main()
