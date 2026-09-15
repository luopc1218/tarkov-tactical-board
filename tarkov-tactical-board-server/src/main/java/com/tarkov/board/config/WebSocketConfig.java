package com.tarkov.board.config;

import com.tarkov.board.websocket.WhiteboardWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private static final String[] ALLOWED_ORIGIN_PATTERNS = {
            "*"
    };

    private final WhiteboardWebSocketHandler whiteboardWebSocketHandler;

    public WebSocketConfig(WhiteboardWebSocketHandler whiteboardWebSocketHandler) {
        this.whiteboardWebSocketHandler = whiteboardWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(whiteboardWebSocketHandler, "/api/ws/whiteboard/**")
                .setAllowedOriginPatterns(ALLOWED_ORIGIN_PATTERNS);
    }
}
