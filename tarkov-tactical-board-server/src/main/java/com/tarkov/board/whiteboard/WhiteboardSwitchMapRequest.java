package com.tarkov.board.whiteboard;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WhiteboardSwitchMapRequest(
        @NotNull @Positive Long mapId,
        @Schema(description = "是否清空当前白板状态，默认 true", defaultValue = "true")
        Boolean resetState
) {

    public boolean shouldResetState() {
        return resetState == null || resetState;
    }
}
