from __future__ import annotations

import asyncio
import json
import logging
import threading
from typing import Protocol

import stomp


class MessageBroker(Protocol):
    async def connect(self) -> None:
        ...

    async def disconnect(self) -> None:
        ...

    async def publish(self, destination: str, body: str) -> None:
        ...


class _ConnectionListener(stomp.ConnectionListener):
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    def on_error(self, frame: stomp.utils.Frame) -> None:
        self._logger.error("ActiveMQ error frame received", extra={"frame": getattr(frame, "body", "")})

    def on_disconnected(self) -> None:
        self._logger.warning("Disconnected from ActiveMQ")


class ActiveMQBroker:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        heartbeat_ms: int,
        logger: logging.Logger,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._heartbeat_ms = heartbeat_ms
        self._logger = logger

        self._connection: stomp.Connection12 | None = None
        self._lock = threading.Lock()

    def _ensure_connection(self) -> stomp.Connection12:
        if self._connection is None:
            connection = stomp.Connection12(
                host_and_ports=[(self._host, self._port)],
                heartbeats=(self._heartbeat_ms, self._heartbeat_ms),
            )
            connection.set_listener("default", _ConnectionListener(self._logger))
            self._connection = connection
        return self._connection

    def _connect_sync(self) -> None:
        with self._lock:
            connection = self._ensure_connection()
            if connection.is_connected():
                return
            connection.connect(self._username, self._password, wait=True)
            self._logger.info("Connected to ActiveMQ", extra={"host": self._host, "port": self._port})

    def _disconnect_sync(self) -> None:
        with self._lock:
            if self._connection is None:
                return
            if self._connection.is_connected():
                self._connection.disconnect()
            self._connection = None

    def _publish_sync(self, destination: str, body: str) -> None:
        with self._lock:
            connection = self._ensure_connection()
            if not connection.is_connected():
                raise RuntimeError("ActiveMQ connection is not active.")
            connection.send(destination=destination, body=body, persistent="true")

    async def connect(self) -> None:
        await asyncio.to_thread(self._connect_sync)

    async def disconnect(self) -> None:
        await asyncio.to_thread(self._disconnect_sync)

    async def publish(self, destination: str, body: str) -> None:
        await asyncio.to_thread(self._publish_sync, destination, body)


class NoopBroker:
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    async def connect(self) -> None:
        self._logger.info("Message broker disabled. Events will only be logged.")

    async def disconnect(self) -> None:
        return

    async def publish(self, destination: str, body: str) -> None:
        parsed = json.loads(body)
        self._logger.info(
            "Event emitted without external broker",
            extra={"destination": destination, "event": parsed.get("event")},
        )
