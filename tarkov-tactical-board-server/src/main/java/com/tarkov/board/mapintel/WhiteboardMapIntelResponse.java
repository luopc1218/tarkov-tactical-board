package com.tarkov.board.mapintel;

import java.time.Instant;
import java.util.List;

public record WhiteboardMapIntelResponse(
        Long mapId,
        String mapNameZh,
        String mapNameEn,
        BossRefreshInfo bossRefresh,
        ExtractionInfo extractions
) {

    public record BossRefreshInfo(
            String sourcePageUrl,
            Instant fetchedAt,
            List<BossSpawnRate> regular,
            List<BossSpawnRate> pve,
            String errorMessage
    ) {
    }

    public record BossSpawnRate(
            String bossName,
            String bossNameZh,
            String spawnChance
    ) {
    }

    public record ExtractionInfo(
            String sourcePageUrl,
            Instant fetchedAt,
            List<ExtractionPoint> points,
            String errorMessage
    ) {
    }

    public record ExtractionPoint(
            String name,
            String faction,
            String requirement,
            String detailUrl,
            ExtractionPointDetail detail
    ) {
    }

    public record ExtractionPointDetail(
            String mapName,
            String faction,
            String requirement,
            Boolean alwaysAvailable,
            Boolean singleUse,
            List<String> imageUrls
    ) {
    }

}
