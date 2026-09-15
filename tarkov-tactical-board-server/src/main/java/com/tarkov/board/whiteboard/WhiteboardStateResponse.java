package com.tarkov.board.whiteboard;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record WhiteboardStateResponse(
        String instanceId,
        JsonNode state,
        Instant updatedAt,
        Instant expireAt
) {
}
