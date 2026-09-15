package com.tarkov.board.mapintel;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MapIntelSnapshotInitializer {

    private final JdbcTemplate jdbcTemplate;

    public MapIntelSnapshotInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS map_intel_snapshot (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    map_id BIGINT NOT NULL,
                    map_name_zh VARCHAR(128) NOT NULL,
                    map_name_en VARCHAR(128) NOT NULL,
                    boss_refresh_json LONGTEXT NULL,
                    extractions_json LONGTEXT NULL,
                    synced_at DATETIME(3) NULL,
                    created_at DATETIME(3) NOT NULL,
                    updated_at DATETIME(3) NOT NULL,
                    UNIQUE KEY uk_map_intel_snapshot_map_id (map_id)
                )
                """);
    }
}
