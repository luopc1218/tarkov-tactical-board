package com.tarkov.board.whiteboard;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WhiteboardCreateInstanceRequest(
        @NotNull @Positive Long mapId
) {
}
