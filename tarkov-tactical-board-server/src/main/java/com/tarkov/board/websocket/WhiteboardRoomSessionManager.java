package com.tarkov.board.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WhiteboardRoomSessionManager {

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    public WhiteboardRoomSessionManager(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void join(String instanceId, WebSocketSession session) {
        roomSessions.computeIfAbsent(instanceId, key -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void leave(String instanceId, WebSocketSession session) {
        Set<WebSocketSession> sessions = roomSessions.get(instanceId);
        if (sessions == null) {
            return;
        }
        sessions.remove(session);
        if (sessions.isEmpty()) {
            roomSessions.remove(instanceId);
        }
    }

    public void relay(String instanceId, WebSocketSession sourceSession, TextMessage message) {
        Set<WebSocketSession> sessions = roomSessions.get(instanceId);
        if (sessions == null) {
            return;
        }

        for (WebSocketSession targetSession : sessions) {
            if (targetSession == sourceSession || !targetSession.isOpen()) {
                continue;
            }
            try {
                targetSession.sendMessage(message);
            } catch (IOException | RuntimeException ignored) {
                sessions.remove(targetSession);
            }
        }
    }

    public void broadcastMapChanged(String instanceId, Long mapId, boolean resetState, Instant changedAt) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(
                    new MapChangedEnvelope("map.changed", instanceId, mapId, resetState, changedAt)
            );
        } catch (JsonProcessingException ignored) {
            return;
        }

        Set<WebSocketSession> sessions = roomSessions.get(instanceId);
        if (sessions == null) {
            return;
        }

        TextMessage message = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(message);
            } catch (IOException | RuntimeException ignored) {
                sessions.remove(session);
            }
        }
    }

    private record MapChangedEnvelope(String type,
                                      String instanceId,
                                      Long mapId,
                                      boolean resetState,
                                      Instant changedAt) {
    }
}
