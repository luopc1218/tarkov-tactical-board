package com.tarkov.board.whiteboard;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class WhiteboardCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(WhiteboardCleanupScheduler.class);

    private final WhiteboardInstanceService instanceService;

    public WhiteboardCleanupScheduler(WhiteboardInstanceService instanceService) {
        this.instanceService = instanceService;
    }

    @Scheduled(fixedDelay = 60 * 60 * 1000)
    public void cleanupExpiredInstances() {
        int deleted = instanceService.cleanupExpiredInstances();
        if (deleted > 0) {
            log.info("Deleted {} expired whiteboard instances", deleted);
        }
    }
}
