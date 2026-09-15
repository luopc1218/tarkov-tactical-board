package com.tarkov.board.whiteboard;

import java.time.Instant;

public record WhiteboardAdminInstanceResponse(
        String instanceId,
        Long mapId,
        Instant createdAt,
        Instant updatedAt,
        Instant expireAt,
        boolean active,
        boolean hasState
) {
}
