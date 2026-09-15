package com.tarkov.board.mapintel;

import java.time.Instant;

public record MapIntelSyncResponse(
        Long mapId,
        String mapNameZh,
        String mapNameEn,
        Instant syncedAt,
        WhiteboardMapIntelResponse.BossRefreshInfo bossRefresh,
        WhiteboardMapIntelResponse.ExtractionInfo extractions
) {
}
