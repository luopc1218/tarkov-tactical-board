package com.tarkov.board.whiteboard;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class WhiteboardInitializer {

    private final JdbcTemplate jdbcTemplate;

    public WhiteboardInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS whiteboard_instance (
                    instance_id VARCHAR(64) PRIMARY KEY,
                    map_id BIGINT NULL,
                    state_json LONGTEXT NULL,
                    created_at DATETIME(3) NOT NULL,
                    updated_at DATETIME(3) NOT NULL,
                    expire_at DATETIME(3) NOT NULL
                )
                """);

        Integer mapIdColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'whiteboard_instance'
                          AND column_name = 'map_id'
                        """,
                Integer.class
        );
        if (mapIdColumnCount != null && mapIdColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE whiteboard_instance ADD COLUMN map_id BIGINT NULL");
        }

        Integer indexCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.statistics
                        WHERE table_schema = DATABASE()
                          AND table_name = 'whiteboard_instance'
                          AND index_name = 'idx_whiteboard_instance_expire_at'
                        """,
                Integer.class
        );
        if (indexCount != null && indexCount == 0) {
            jdbcTemplate.execute("""
                    CREATE INDEX idx_whiteboard_instance_expire_at
                    ON whiteboard_instance (expire_at)
                    """);
        }
    }
}
