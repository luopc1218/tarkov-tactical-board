package com.tarkov.board.whiteboard;

import java.time.Instant;

public record WhiteboardAdminInstanceResponse(
        String instanceId,
        String mapNameZh,
        String mapNameEn,
        Instant createdAt,
        Instant updatedAt,
        Instant expireAt,
        boolean active,
        boolean hasState
) {
}
