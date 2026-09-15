package com.tarkov.board.mapintel;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarkov.board.map.TarkovMapEntity;
import com.tarkov.board.map.TarkovMapRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class MapIntelSnapshotService {

    private final MapIntelSnapshotRepository snapshotRepository;
    private final TarkovMapRepository mapRepository;
    private final EftarkovMapIntelService mapIntelService;
    private final ObjectMapper objectMapper;

    public MapIntelSnapshotService(MapIntelSnapshotRepository snapshotRepository,
                                   TarkovMapRepository mapRepository,
                                   EftarkovMapIntelService mapIntelService,
                                   ObjectMapper objectMapper) {
        this.snapshotRepository = snapshotRepository;
        this.mapRepository = mapRepository;
        this.mapIntelService = mapIntelService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public WhiteboardMapIntelResponse getMapIntel(TarkovMapEntity map) {
        return snapshotRepository.findByMapId(map.getId())
                .map(entity -> toMapIntelResponse(entity, map))
                .orElseGet(() -> buildUnsyncedResponse(map));
    }

    @Transactional(readOnly = true)
    public MapIntelSyncResponse getAdminSnapshot(Long mapId) {
        TarkovMapEntity map = getMapOrThrow(mapId);
        return snapshotRepository.findByMapId(mapId)
                .map(entity -> toAdminResponse(entity, map))
                .orElseGet(() -> new MapIntelSyncResponse(
                        map.getId(),
                        map.getNameZh(),
                        map.getNameEn(),
                        null,
                        unsyncedBossInfo(),
                        unsyncedExtractionInfo()
                ));
    }

    @Transactional(readOnly = true)
    public List<MapIntelSyncResponse> listAdminSnapshots() {
        Map<Long, MapIntelSnapshotEntity> snapshotByMapId = snapshotRepository.findAllByOrderByMapIdAsc().stream()
                .collect(Collectors.toMap(MapIntelSnapshotEntity::getMapId, Function.identity(), (left, right) -> right));

        return mapRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(map -> {
                    MapIntelSnapshotEntity entity = snapshotByMapId.get(map.getId());
                    if (entity == null) {
                        return new MapIntelSyncResponse(
                                map.getId(),
                                map.getNameZh(),
                                map.getNameEn(),
                                null,
                                unsyncedBossInfo(),
                                unsyncedExtractionInfo()
                        );
                    }
                    return toAdminResponse(entity, map);
                })
                .toList();
    }

    @Transactional
    public MapIntelSyncResponse syncMap(Long mapId) {
        TarkovMapEntity map = getMapOrThrow(mapId);
        WhiteboardMapIntelResponse.BossRefreshInfo bossRefresh = mapIntelService.getBossRefreshInfo(map);
        WhiteboardMapIntelResponse.ExtractionInfo extractions = mapIntelService.getExtractionInfo(map);
        Instant now = Instant.now();

        MapIntelSnapshotEntity entity = snapshotRepository.findByMapId(mapId)
                .orElseGet(() -> new MapIntelSnapshotEntity(
                        map.getId(),
                        map.getNameZh(),
                        map.getNameEn(),
                        null,
                        null,
                        null,
                        now,
                        now
                ));
        entity.setMapId(map.getId());
        entity.setMapNameZh(map.getNameZh());
        entity.setMapNameEn(map.getNameEn());
        entity.setBossRefreshJson(writeJson(bossRefresh));
        entity.setExtractionsJson(writeJson(extractions));
        entity.setSyncedAt(now);
        entity.setUpdatedAt(now);
        snapshotRepository.save(entity);
        return toAdminResponse(entity, map);
    }

    @Transactional
    public List<MapIntelSyncResponse> syncAllMaps() {
        return mapRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(TarkovMapEntity::getId)
                .map(this::syncMap)
                .toList();
    }

    private WhiteboardMapIntelResponse toMapIntelResponse(MapIntelSnapshotEntity entity, TarkovMapEntity map) {
        return new WhiteboardMapIntelResponse(
                map.getId(),
                map.getNameZh(),
                map.getNameEn(),
                readJson(entity.getBossRefreshJson(), WhiteboardMapIntelResponse.BossRefreshInfo.class, unsyncedBossInfo()),
                readJson(entity.getExtractionsJson(), WhiteboardMapIntelResponse.ExtractionInfo.class, unsyncedExtractionInfo())
        );
    }

    private MapIntelSyncResponse toAdminResponse(MapIntelSnapshotEntity entity, TarkovMapEntity map) {
        WhiteboardMapIntelResponse mapIntel = toMapIntelResponse(entity, map);
        return new MapIntelSyncResponse(
                mapIntel.mapId(),
                mapIntel.mapNameZh(),
                mapIntel.mapNameEn(),
                entity.getSyncedAt(),
                mapIntel.bossRefresh(),
                mapIntel.extractions()
        );
    }

    private WhiteboardMapIntelResponse buildUnsyncedResponse(TarkovMapEntity map) {
        return new WhiteboardMapIntelResponse(
                map.getId(),
                map.getNameZh(),
                map.getNameEn(),
                unsyncedBossInfo(),
                unsyncedExtractionInfo()
        );
    }

    private WhiteboardMapIntelResponse.BossRefreshInfo unsyncedBossInfo() {
        return new WhiteboardMapIntelResponse.BossRefreshInfo(
                null,
                null,
                List.of(),
                List.of(),
                "尚未同步 Boss 情报，请在管理端手动同步"
        );
    }

    private WhiteboardMapIntelResponse.ExtractionInfo unsyncedExtractionInfo() {
        return new WhiteboardMapIntelResponse.ExtractionInfo(
                null,
                null,
                List.of(),
                "尚未同步撤离点情报，请在管理端手动同步"
        );
    }

    private TarkovMapEntity getMapOrThrow(Long mapId) {
        return mapRepository.findById(mapId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Map not found"));
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize intel snapshot", e);
        }
    }

    private <T> T readJson(String json, Class<T> type, T fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            return fallback;
        }
    }
}
