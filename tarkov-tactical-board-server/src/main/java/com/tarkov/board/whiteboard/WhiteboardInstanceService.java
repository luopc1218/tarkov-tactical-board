package com.tarkov.board.whiteboard;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarkov.board.map.TarkovMapEntity;
import com.tarkov.board.map.TarkovMapRepository;
import com.tarkov.board.mapintel.MapIntelSnapshotService;
import com.tarkov.board.mapintel.WhiteboardMapIntelResponse;
import com.tarkov.board.websocket.WhiteboardRoomSessionManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class WhiteboardInstanceService {

    private static final Set<String> SNAPSHOT_TYPES = Set.of("snapshot", "state_snapshot", "full_state");
    private static final int MAX_INSTANCE_COUNT = 100;

    private final WhiteboardInstanceRepository repository;
    private final TarkovMapRepository mapRepository;
    private final WhiteboardRoomSessionManager roomSessionManager;
    private final ObjectMapper objectMapper;
    private final MapIntelSnapshotService mapIntelSnapshotService;
    private final ReentrantLock createInstanceLock = new ReentrantLock();

    public WhiteboardInstanceService(WhiteboardInstanceRepository repository,
                                     TarkovMapRepository mapRepository,
                                     WhiteboardRoomSessionManager roomSessionManager,
                                     ObjectMapper objectMapper,
                                     MapIntelSnapshotService mapIntelSnapshotService) {
        this.repository = repository;
        this.mapRepository = mapRepository;
        this.roomSessionManager = roomSessionManager;
        this.objectMapper = objectMapper;
        this.mapIntelSnapshotService = mapIntelSnapshotService;
    }

    @Transactional
    public WhiteboardInstanceResponse createInstance(Long mapId) {
        createInstanceLock.lock();
        try {
            validateMapExists(mapId);
            cleanupExpiredInstances();
            evictOldestInstancesIfNeededForCreate();

            Instant now = Instant.now();
            String instanceId = UUID.randomUUID().toString();
            WhiteboardInstanceEntity entity = new WhiteboardInstanceEntity(
                    instanceId, mapId, null, now, now, now.plus(WhiteboardRetention.INSTANCE_TTL));
            repository.save(entity);
            return toResponse(entity);
        } finally {
            createInstanceLock.unlock();
        }
    }

    @Transactional
    public WhiteboardInstanceResponse getInstance(String instanceId) {
        return toResponse(getActiveEntityOrThrow(instanceId));
    }

    @Transactional
    public boolean isInstanceActive(String instanceId) {
        Instant now = Instant.now();
        return repository.touchExpireAtIfActive(instanceId, now, now.plus(WhiteboardRetention.INSTANCE_TTL)) > 0;
    }

    @Transactional
    public WhiteboardStateResponse getState(String instanceId) {
        WhiteboardInstanceEntity entity = getActiveEntityOrThrow(instanceId);
        return new WhiteboardStateResponse(
                entity.getInstanceId(),
                parseState(entity.getStateJson()),
                entity.getUpdatedAt(),
                entity.getExpireAt()
        );
    }

    @Transactional
    public WhiteboardStateResponse saveState(String instanceId, JsonNode state) {
        WhiteboardInstanceEntity entity = getActiveEntityOrThrow(instanceId);
        saveStateInternal(entity, state);
        repository.save(entity);
        return new WhiteboardStateResponse(
                entity.getInstanceId(),
                parseState(entity.getStateJson()),
                entity.getUpdatedAt(),
                entity.getExpireAt()
        );
    }

    @Transactional
    public WhiteboardMapIntelResponse getMapIntel(String instanceId) {
        WhiteboardInstanceEntity entity = getActiveEntityOrThrow(instanceId);
        if (entity.getMapId() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Current instance has no map selected");
        }

        TarkovMapEntity map = mapRepository.findById(entity.getMapId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Map not found"));

        return mapIntelSnapshotService.getMapIntel(map);
    }

    @Transactional
    public WhiteboardInstanceResponse switchMap(String instanceId, Long mapId, boolean resetState) {
        validateMapExists(mapId);
        WhiteboardInstanceEntity entity = getActiveEntityOrThrow(instanceId);

        boolean mapChanged = !mapId.equals(entity.getMapId());
        Instant now = Instant.now();

        entity.setMapId(mapId);
        entity.setUpdatedAt(now);
        entity.setExpireAt(now.plus(WhiteboardRetention.INSTANCE_TTL));
        if (resetState) {
            entity.setStateJson(null);
        }
        repository.save(entity);

        if (mapChanged || resetState) {
            roomSessionManager.broadcastMapChanged(instanceId, mapId, resetState, now);
        }
        return toResponse(entity);
    }

    @Transactional
    public void persistSnapshotFromWebSocket(String instanceId, String payload) {
        WhiteboardInstanceEntity entity = repository.findByInstanceIdAndExpireAtAfter(instanceId, Instant.now())
                .orElse(null);
        if (entity == null) {
            return;
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (JsonProcessingException ignored) {
            return;
        }

        if (!root.isObject()) {
            return;
        }

        String messageType = root.path("type").asText("").toLowerCase(Locale.ROOT);
        if (!SNAPSHOT_TYPES.contains(messageType)) {
            return;
        }

        JsonNode state = root.hasNonNull("state") ? root.get("state") : root.path("data");
        if (state == null || state.isMissingNode() || state.isNull()) {
            return;
        }

        saveStateInternal(entity, state);
        repository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<WhiteboardAdminInstanceResponse> listInstances(boolean includeExpired, Integer page, Integer size) {
        Instant now = Instant.now();
        List<WhiteboardInstanceEntity> instances = fetchInstances(includeExpired, now, page, size);
        Map<Long, MapNames> mapNameById = resolveMapNames(instances);
        return instances.stream()
                .map(entity -> toAdminResponse(entity, now, mapNameById))
                .toList();
    }

    @Transactional
    public void deleteInstance(String instanceId) {
        if (!repository.existsByInstanceId(instanceId)) {
            throw new ResponseStatusException(NOT_FOUND, "Whiteboard instance not found");
        }
        repository.deleteById(instanceId);
    }

    @Transactional
    public void clearAllInstances() {
        repository.deleteAllInBatch();
    }

    @Transactional
    public int cleanupExpiredInstances() {
        return repository.deleteExpired(Instant.now());
    }

    private void saveStateInternal(WhiteboardInstanceEntity entity, JsonNode state) {
        Instant now = Instant.now();
        entity.setStateJson(writeState(state));
        entity.setUpdatedAt(now);
        entity.setExpireAt(now.plus(WhiteboardRetention.INSTANCE_TTL));
    }

    private JsonNode parseState(String stateJson) {
        if (stateJson == null || stateJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(stateJson);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored whiteboard state is invalid JSON", e);
        }
    }

    private String writeState(JsonNode state) {
        try {
            return objectMapper.writeValueAsString(state);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid whiteboard state JSON", e);
        }
    }

    private WhiteboardInstanceEntity getActiveEntityOrThrow(String instanceId) {
        touchInstanceTtlOrThrow(instanceId);
        return repository.findById(instanceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Whiteboard instance not found or expired"));
    }

    private void touchInstanceTtlOrThrow(String instanceId) {
        Instant now = Instant.now();
        int touched = repository.touchExpireAtIfActive(instanceId, now, now.plus(WhiteboardRetention.INSTANCE_TTL));
        if (touched == 0) {
            throw new ResponseStatusException(NOT_FOUND, "Whiteboard instance not found or expired");
        }
    }

    private WhiteboardInstanceResponse toResponse(WhiteboardInstanceEntity entity) {
        return new WhiteboardInstanceResponse(
                entity.getInstanceId(),
                entity.getMapId(),
                entity.getCreatedAt(),
                entity.getExpireAt()
        );
    }

    private List<WhiteboardInstanceEntity> fetchInstances(boolean includeExpired, Instant now, Integer page, Integer size) {
        if (page == null && size == null) {
            return includeExpired
                    ? repository.findAllByOrderByCreatedAtDesc()
                    : repository.findByExpireAtAfterOrderByCreatedAtDesc(now);
        }

        if (page == null || size == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Both page and size are required for pagination");
        }
        if (page < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "page must be greater than or equal to 0");
        }
        if (size <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "size must be greater than 0");
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return includeExpired
                ? repository.findAll(pageable).getContent()
                : repository.findByExpireAtAfter(now, pageable).getContent();
    }

    private Map<Long, MapNames> resolveMapNames(List<WhiteboardInstanceEntity> instances) {
        Set<Long> mapIds = instances.stream()
                .map(WhiteboardInstanceEntity::getMapId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (mapIds.isEmpty()) {
            return Map.of();
        }

        return mapRepository.findAllById(mapIds).stream()
                .collect(Collectors.toMap(
                        TarkovMapEntity::getId,
                        map -> new MapNames(map.getNameZh(), map.getNameEn())
                ));
    }

    private WhiteboardAdminInstanceResponse toAdminResponse(WhiteboardInstanceEntity entity,
                                                            Instant now,
                                                            Map<Long, MapNames> mapNameById) {
        MapNames mapNames = mapNameById.get(entity.getMapId());
        return new WhiteboardAdminInstanceResponse(
                entity.getInstanceId(),
                mapNames == null ? null : mapNames.nameZh(),
                mapNames == null ? null : mapNames.nameEn(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getExpireAt(),
                entity.getExpireAt().isAfter(now),
                entity.getStateJson() != null && !entity.getStateJson().isBlank()
        );
    }

    private record MapNames(String nameZh, String nameEn) {
    }

    private void validateMapExists(Long mapId) {
        if (!mapRepository.existsById(mapId)) {
            throw new ResponseStatusException(BAD_REQUEST, "Map not found");
        }
    }

    private void evictOldestInstancesIfNeededForCreate() {
        long currentCount = repository.count();
        long overflow = currentCount - MAX_INSTANCE_COUNT + 1;
        if (overflow <= 0) {
            return;
        }

        int deleteCount = (int) overflow;
        List<WhiteboardInstanceEntity> oldestInstances = repository.findAllByOrderByCreatedAtAsc(
                PageRequest.of(0, deleteCount)
        );
        if (oldestInstances.isEmpty()) {
            return;
        }

        List<String> oldestIds = oldestInstances.stream()
                .map(WhiteboardInstanceEntity::getInstanceId)
                .toList();
        repository.deleteAllByIdInBatch(oldestIds);
    }
}
