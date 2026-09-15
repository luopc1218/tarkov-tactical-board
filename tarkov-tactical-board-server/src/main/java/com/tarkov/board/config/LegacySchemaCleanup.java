package com.tarkov.board.config;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LegacySchemaCleanup {

    private final JdbcTemplate jdbcTemplate;

    public LegacySchemaCleanup(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void dropLegacyMapTables() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS map_intel_snapshot");
        jdbcTemplate.execute("DROP TABLE IF EXISTS tarkov_map");
    }
}
