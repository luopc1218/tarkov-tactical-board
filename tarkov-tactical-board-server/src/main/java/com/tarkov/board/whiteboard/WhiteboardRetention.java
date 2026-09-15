package com.tarkov.board.whiteboard;

import java.time.Duration;

public final class WhiteboardRetention {

    public static final Duration INSTANCE_TTL = Duration.ofHours(24);

    private WhiteboardRetention() {
    }
}
