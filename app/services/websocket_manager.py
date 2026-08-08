import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class PartnerSocketManager:
    def __init__(self):
        # Maps partner_id -> set of active WebSockets (allows multi-device/reconnects)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store in-memory ringing state: order_id -> set of notified partner_ids
        self.ringing_orders: Dict[str, dict] = {}
        # Order live tracking room: order_id -> set of active WebSockets (Customer + Partner)
        self.order_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, partner_id: str, websocket: WebSocket):
        await websocket.accept()
        if partner_id not in self.active_connections:
            self.active_connections[partner_id] = set()
        self.active_connections[partner_id].add(websocket)
        logger.info(f"WebSocket connected for Partner ID: {partner_id}")

    def disconnect(self, partner_id: str, websocket: WebSocket):
        if partner_id in self.active_connections:
            self.active_connections[partner_id].discard(websocket)
            if not self.active_connections[partner_id]:
                del self.active_connections[partner_id]
        logger.info(f"WebSocket disconnected for Partner ID: {partner_id}")

    async def connect_order_room(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.order_rooms:
            self.order_rooms[order_id] = set()
        self.order_rooms[order_id].add(websocket)
        logger.info(f"WebSocket connected for Order Room: {order_id}")

    def disconnect_order_room(self, order_id: str, websocket: WebSocket):
        if order_id in self.order_rooms:
            self.order_rooms[order_id].discard(websocket)
            if not self.order_rooms[order_id]:
                del self.order_rooms[order_id]
        logger.info(f"WebSocket disconnected for Order Room: {order_id}")

    async def broadcast_order_live_location(
        self, order_id: str, sender_role: str, sender_id: str, location_payload: dict
    ):
        """
        Broadcast live GPS location update (latitude, longitude, speed, address) 
        to both Customer and Partner connected to order room order_id.
        """
        if order_id in self.order_rooms:
            msg = {
                "type": "LIVE_LOCATION_UPDATE",
                "order_id": order_id,
                "sender_role": sender_role,
                "sender_id": sender_id,
                "location": location_payload,
            }
            to_remove = set()
            for ws in self.order_rooms[order_id]:
                try:
                    await ws.send_json(msg)
                except Exception as e:
                    logger.error(f"Error broadcasting live location for order {order_id}: {e}")
                    to_remove.add(ws)
            for ws in to_remove:
                self.disconnect_order_room(order_id, ws)


    async def send_personal_message(self, partner_id: str, message: dict):
        if partner_id in self.active_connections:
            to_remove = set()
            for ws in self.active_connections[partner_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending socket message to partner {partner_id}: {e}")
                    to_remove.add(ws)
            for ws in to_remove:
                self.disconnect(partner_id, ws)

    async def ring_partners_within_1km(
        self, order_id: str, partner_distances: List[tuple], order_payload: dict
    ):
        """
        Ring open partner app connections within 1KM radius.
        partner_distances: list of (partner_user, distance_km)
        """
        notified_ids = []
        ring_message = {
            "type": "ORDER_RING",
            "event": "INCOMING_DELIVERY_CALL",
            "order_id": order_id,
            "order": order_payload,
            "ring_sound": "loud_phone_ring",
            "message": "New order ringing within 1 KM! First partner to accept gets the order delivery.",
        }

        for partner, dist in partner_distances:
            pid = str(partner.id)
            notified_ids.append(pid)
            partner_ring_payload = {
                **ring_message,
                "distance_km": dist,
                "distance_meters": int(dist * 1000),
            }
            await self.send_personal_message(pid, partner_ring_payload)

        # Record ringing order state
        self.ringing_orders[order_id] = {
            "order_id": order_id,
            "order": order_payload,
            "notified_partner_ids": notified_ids,
            "status": "ringing",
        }
        return notified_ids

    async def notify_order_accepted(self, order_id: str, accepted_partner_id: str, notified_partner_ids: List[str]):
        """
        Notify all partners who were ringing that the order has been claimed by 1st accept partner.
        """
        if order_id in self.ringing_orders:
            self.ringing_orders[order_id]["status"] = "accepted"
            self.ringing_orders[order_id]["accepted_by"] = accepted_partner_id

        taken_message = {
            "type": "ORDER_TAKEN",
            "event": "ORDER_ACCEPTED_BY_ANOTHER_PARTNER",
            "order_id": order_id,
            "accepted_by_partner_id": accepted_partner_id,
            "message": "Order was accepted by another partner.",
        }

        success_message = {
            "type": "ORDER_ASSIGNED",
            "event": "YOU_ACCEPTED_THE_ORDER",
            "order_id": order_id,
            "message": "Order successfully assigned to you! Proceed to pickup.",
        }

        for pid in notified_partner_ids:
            if pid == accepted_partner_id:
                await self.send_personal_message(pid, success_message)
            else:
                await self.send_personal_message(pid, taken_message)

    def get_active_ringing_orders_for_partner(self, partner_id: str) -> List[dict]:
        """Fetch ringing orders for a partner (polling fallback)."""
        active = []
        for order_id, info in self.ringing_orders.items():
            if info["status"] == "ringing" and partner_id in info["notified_partner_ids"]:
                active.append(info)
        return active


socket_manager = PartnerSocketManager()
