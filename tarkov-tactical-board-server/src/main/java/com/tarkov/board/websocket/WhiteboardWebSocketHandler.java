package com.tarkov.board.websocket;

import com.tarkov.board.whiteboard.WhiteboardInstanceService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Component
public class WhiteboardWebSocketHandler extends TextWebSocketHandler {

    private static final String WHITEBOARD_PATH_PREFIX = "/api/ws/whiteboard/";
    private static final String INSTANCE_ID_ATTR = "whiteboardInstanceId";

    private final WhiteboardInstanceService instanceService;
    private final WhiteboardRoomSessionManager sessionManager;

    public WhiteboardWebSocketHandler(WhiteboardInstanceService instanceService,
                                      WhiteboardRoomSessionManager sessionManager) {
        this.instanceService = instanceService;
        this.sessionManager = sessionManager;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        String instanceId = resolveInstanceId(session.getUri());
        if (!StringUtils.hasText(instanceId)) {
            session.close(CloseStatus.BAD_DATA.withReason("Missing whiteboard instanceId"));
            return;
        }

        if (!instanceService.isInstanceActive(instanceId)) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Whiteboard instance not found"));
            return;
        }

        sessionManager.join(instanceId, session);
        session.getAttributes().put(INSTANCE_ID_ATTR, instanceId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String instanceId = (String) session.getAttributes().get(INSTANCE_ID_ATTR);
        if (!StringUtils.hasText(instanceId)) {
            return;
        }

        if (!instanceService.isInstanceActive(instanceId)) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Whiteboard instance expired"));
            return;
        }

        instanceService.persistSnapshotFromWebSocket(instanceId, message.getPayload());
        sessionManager.relay(instanceId, session, message);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String instanceId = (String) session.getAttributes().get(INSTANCE_ID_ATTR);
        if (!StringUtils.hasText(instanceId)) {
            return;
        }

        sessionManager.leave(instanceId, session);
    }

    private String resolveInstanceId(URI uri) {
        if (uri == null) {
            return null;
        }

        String instanceIdFromPath = resolveInstanceIdFromPath(uri.getPath());
        if (StringUtils.hasText(instanceIdFromPath)) {
            return instanceIdFromPath;
        }

        return resolveInstanceIdFromQuery(uri.getQuery());
    }

    private String resolveInstanceIdFromPath(String path) {
        if (!StringUtils.hasText(path)) {
            return null;
        }

        int prefixIndex = path.indexOf(WHITEBOARD_PATH_PREFIX);
        if (prefixIndex < 0) {
            return null;
        }

        String raw = path.substring(prefixIndex + WHITEBOARD_PATH_PREFIX.length());
        String instanceId = raw.contains("/") ? raw.substring(0, raw.indexOf('/')) : raw;
        return StringUtils.hasText(instanceId) ? instanceId : null;
    }

    private String resolveInstanceIdFromQuery(String query) {
        if (!StringUtils.hasText(query)) {
            return null;
        }
        for (String part : query.split("&")) {
            String[] keyValue = part.split("=", 2);
            if (keyValue.length == 2 && "instanceId".equals(keyValue[0])) {
                return URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
