package com.tarkov.board.map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class TarkovMapService {

    private final TarkovMapRepository repository;

    public TarkovMapService(TarkovMapRepository repository) {
        this.repository = repository;
    }

    public List<TarkovMapResponse> listMaps() {
        return repository.findAllByOrderBySortOrderAscIdAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TarkovMapResponse create(TarkovMapUpsertRequest request) {
        TarkovMapEntity entity = new TarkovMapEntity(
                request.nameZh(),
                request.nameEn(),
                normalizeText(request.bannerFileName()),
                normalizeText(request.mapFileName()),
                repository.findMaxSortOrder() + 1
        );
        return toResponse(repository.save(entity));
    }

    @Transactional
    public TarkovMapResponse update(Long id, TarkovMapUpsertRequest request) {
        TarkovMapEntity entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Map not found"));

        entity.setNameZh(request.nameZh());
        entity.setNameEn(request.nameEn());
        entity.setBannerFileName(normalizeText(request.bannerFileName()));
        entity.setMapFileName(normalizeText(request.mapFileName()));

        return toResponse(repository.save(entity));
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }

    @Transactional
    public void delete(Long id) {
        TarkovMapEntity entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Map not found"));
        repository.delete(entity);
        normalizeSortOrder();
    }

    @Transactional
    public List<TarkovMapResponse> reorder(TarkovMapReorderRequest request) {
        List<TarkovMapEntity> maps = repository.findAllByOrderBySortOrderAscIdAsc();
        if (maps.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "No maps to reorder");
        }

        List<Long> orderedIds = request.mapIds();
        Set<Long> uniqueIds = orderedIds.stream().collect(Collectors.toSet());
        if (orderedIds.size() != uniqueIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "mapIds contains duplicate ids");
        }
        if (orderedIds.size() != maps.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "mapIds size does not match map count");
        }

        Map<Long, TarkovMapEntity> mapById = new HashMap<>();
        for (TarkovMapEntity map : maps) {
            mapById.put(map.getId(), map);
        }
        if (!mapById.keySet().equals(uniqueIds)) {
            throw new ResponseStatusException(BAD_REQUEST, "mapIds must contain all map ids");
        }

        for (int i = 0; i < orderedIds.size(); i++) {
            mapById.get(orderedIds.get(i)).setSortOrder(i + 1);
        }
        repository.saveAll(mapById.values());
        return listMaps();
    }

    private TarkovMapResponse toResponse(TarkovMapEntity entity) {
        return new TarkovMapResponse(
                entity.getId(),
                entity.getNameZh(),
                entity.getNameEn(),
                entity.getSortOrder(),
                networkUrlOrNull(entity.getBannerFileName()),
                networkUrlOrNull(entity.getMapFileName())
        );
    }

    private String networkUrlOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return isHttpUrl(trimmed) ? trimmed : null;
    }

    private boolean isHttpUrl(String value) {
        return value.regionMatches(true, 0, "http://", 0, "http://".length())
                || value.regionMatches(true, 0, "https://", 0, "https://".length());
    }

    private void normalizeSortOrder() {
        List<TarkovMapEntity> maps = repository.findAllByOrderBySortOrderAscIdAsc();
        for (int i = 0; i < maps.size(); i++) {
            maps.get(i).setSortOrder(i + 1);
        }
        repository.saveAll(maps);
    }
}
