package com.tarkov.board.whiteboard;

import java.time.Instant;

public record WhiteboardInstanceResponse(
        String instanceId,
        Long mapId,
        Instant createdAt,
        Instant expireAt
) {
}
