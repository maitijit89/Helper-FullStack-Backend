from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import socket_manager

router = APIRouter()


@router.websocket("/partner/{partner_id}")
async def partner_websocket_endpoint(websocket: WebSocket, partner_id: str):
    """
    WebSocket endpoint for open delivery partner app.
    Rings partner phone app in real-time when an order is placed within 1 KM radius.
    """
    await socket_manager.connect(partner_id, websocket)
    try:
        while True:
            # Keep connection alive & listen for client ping/messages
            data = await websocket.receive_text()
            # Send pong / heartbeat acknowledgment
            await websocket.send_json({"type": "PONG", "received": data})
    except WebSocketDisconnect:
        socket_manager.disconnect(partner_id, websocket)
    except Exception:
        socket_manager.disconnect(partner_id, websocket)


@router.websocket("/orders/{order_id}")
async def order_live_location_websocket(
    websocket: WebSocket, order_id: str, user_id: str = "guest", role: str = "user"
):
    """
    Bi-directional Live Location Tracking WebSocket for an active delivery order.
    Both Customer and Partner connect to stream and receive real-time live GPS coordinates.
    """
    await socket_manager.connect_order_room(order_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "LOCATION_UPDATE":
                lat = data.get("latitude")
                lon = data.get("longitude")
                address = data.get("address")

                if lat is not None and lon is not None:
                    location_payload = {
                        "latitude": float(lat),
                        "longitude": float(lon),
                        "address": address,
                        "is_gps_enabled": True,
                    }

                    # Broadcast to counterparty in order room
                    await socket_manager.broadcast_order_live_location(
                        order_id=order_id,
                        sender_role=role,
                        sender_id=user_id,
                        location_payload=location_payload,
                    )
            else:
                await websocket.send_json({"type": "PONG", "received": data})
    except WebSocketDisconnect:
        socket_manager.disconnect_order_room(order_id, websocket)
    except Exception:
        socket_manager.disconnect_order_room(order_id, websocket)
