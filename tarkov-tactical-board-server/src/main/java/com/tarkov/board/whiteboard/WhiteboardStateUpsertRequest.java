package com.tarkov.board.whiteboard;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

public record WhiteboardStateUpsertRequest(
        @NotNull JsonNode state
) {
}
