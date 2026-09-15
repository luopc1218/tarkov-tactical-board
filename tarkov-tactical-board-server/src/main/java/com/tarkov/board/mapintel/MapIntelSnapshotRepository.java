package com.tarkov.board.mapintel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MapIntelSnapshotRepository extends JpaRepository<MapIntelSnapshotEntity, Long> {

    Optional<MapIntelSnapshotEntity> findByMapId(Long mapId);

    List<MapIntelSnapshotEntity> findAllByOrderByMapIdAsc();
}
