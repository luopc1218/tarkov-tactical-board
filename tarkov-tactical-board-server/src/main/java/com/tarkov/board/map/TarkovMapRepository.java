package com.tarkov.board.map;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TarkovMapRepository extends JpaRepository<TarkovMapEntity, Long> {

    List<TarkovMapEntity> findAllByOrderBySortOrderAscIdAsc();

    @Query("SELECT COALESCE(MAX(m.sortOrder), 0) FROM TarkovMapEntity m")
    int findMaxSortOrder();
}
