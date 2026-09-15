package com.tarkov.board.map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class TarkovMapInitializer {

    private static final String MAP_SEED_RESOURCE = "seeds/tarkov-maps.json";

    private final JdbcTemplate jdbcTemplate;
    private final TarkovMapRepository repository;
    private final ObjectMapper objectMapper;

    public TarkovMapInitializer(JdbcTemplate jdbcTemplate,
                                TarkovMapRepository repository,
                                ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        createTableIfNeeded();
        seedDefaultMapsIfEmpty();
        normalizeSortOrder();
    }

    private void createTableIfNeeded() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS tarkov_map (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    name_zh VARCHAR(128) NOT NULL,
                    name_en VARCHAR(128) NOT NULL,
                    banner_file_name VARCHAR(2048) NULL,
                    map_file_name VARCHAR(2048) NULL,
                    sort_order INT NOT NULL DEFAULT 0
                )
                """);

        renameOldColumnsIfPresent();
        ensureNewColumnsPresent();
        expandImageSourceColumns();
        migrateAndDropCodeColumnIfPresent();
    }

    private void renameOldColumnsIfPresent() {
        Integer oldBannerColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'banner_object_name'
                """,
                Integer.class
        );
        Integer currentBannerColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'banner_file_name'
                        """,
                Integer.class
        );
        Integer legacyBannerPathColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'banner_path'
                        """,
                Integer.class
        );

        if (oldBannerColumnCount != null && oldBannerColumnCount > 0) {
            if (currentBannerColumnCount != null && currentBannerColumnCount > 0) {
                jdbcTemplate.update("""
                        UPDATE tarkov_map
                        SET banner_file_name = COALESCE(NULLIF(banner_file_name, ''), banner_object_name)
                        WHERE banner_object_name IS NOT NULL AND banner_object_name <> ''
                        """);
                jdbcTemplate.execute("ALTER TABLE tarkov_map DROP COLUMN banner_object_name");
            } else {
                jdbcTemplate.execute("ALTER TABLE tarkov_map CHANGE COLUMN banner_object_name banner_file_name VARCHAR(2048) NULL");
            }
        }

        if (legacyBannerPathColumnCount != null && legacyBannerPathColumnCount > 0) {
            if (currentBannerColumnCount != null && currentBannerColumnCount > 0) {
                jdbcTemplate.update("""
                        UPDATE tarkov_map
                        SET banner_file_name = COALESCE(NULLIF(banner_file_name, ''), banner_path)
                        WHERE banner_path IS NOT NULL AND banner_path <> ''
                        """);
                jdbcTemplate.execute("ALTER TABLE tarkov_map DROP COLUMN banner_path");
            } else {
                jdbcTemplate.execute("ALTER TABLE tarkov_map CHANGE COLUMN banner_path banner_file_name VARCHAR(2048) NULL");
            }
        }

        Integer oldMapColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'map_object_name'
                """,
                Integer.class
        );
        Integer currentMapColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'map_file_name'
                        """,
                Integer.class
        );
        Integer legacyMapPathColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'map_path'
                        """,
                Integer.class
        );

        if (oldMapColumnCount != null && oldMapColumnCount > 0) {
            if (currentMapColumnCount != null && currentMapColumnCount > 0) {
                jdbcTemplate.update("""
                        UPDATE tarkov_map
                        SET map_file_name = COALESCE(NULLIF(map_file_name, ''), map_object_name)
                        WHERE map_object_name IS NOT NULL AND map_object_name <> ''
                        """);
                jdbcTemplate.execute("ALTER TABLE tarkov_map DROP COLUMN map_object_name");
            } else {
                jdbcTemplate.execute("ALTER TABLE tarkov_map CHANGE COLUMN map_object_name map_file_name VARCHAR(2048) NULL");
            }
        }

        if (legacyMapPathColumnCount != null && legacyMapPathColumnCount > 0) {
            if (currentMapColumnCount != null && currentMapColumnCount > 0) {
                jdbcTemplate.update("""
                        UPDATE tarkov_map
                        SET map_file_name = COALESCE(NULLIF(map_file_name, ''), map_path)
                        WHERE map_path IS NOT NULL AND map_path <> ''
                        """);
                jdbcTemplate.execute("ALTER TABLE tarkov_map DROP COLUMN map_path");
            } else {
                jdbcTemplate.execute("ALTER TABLE tarkov_map CHANGE COLUMN map_path map_file_name VARCHAR(2048) NULL");
            }
        }
    }

    private void ensureNewColumnsPresent() {
        Integer bannerColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'banner_file_name'
                        """,
                Integer.class
        );
        if (bannerColumnCount != null && bannerColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE tarkov_map ADD COLUMN banner_file_name VARCHAR(2048) NULL");
        }

        Integer mapColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'map_file_name'
                        """,
                Integer.class
        );
        if (mapColumnCount != null && mapColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE tarkov_map ADD COLUMN map_file_name VARCHAR(2048) NULL");
        }

        Integer sortColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'sort_order'
                        """,
                Integer.class
        );
        if (sortColumnCount != null && sortColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE tarkov_map ADD COLUMN sort_order INT NOT NULL DEFAULT 0");
        }
    }

    private void expandImageSourceColumns() {
        jdbcTemplate.execute("ALTER TABLE tarkov_map MODIFY COLUMN banner_file_name VARCHAR(2048) NULL");
        jdbcTemplate.execute("ALTER TABLE tarkov_map MODIFY COLUMN map_file_name VARCHAR(2048) NULL");
    }

    private void migrateAndDropCodeColumnIfPresent() {
        Integer codeColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'tarkov_map'
                          AND column_name = 'code'
                        """,
                Integer.class
        );
        if (codeColumnCount == null || codeColumnCount == 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE tarkov_map DROP COLUMN code");
    }

    private void seedDefaultMapsIfEmpty() {
        if (repository.count() > 0) {
            return;
        }

        repository.saveAll(loadSeedMaps());
    }

    private List<TarkovMapEntity> loadSeedMaps() {
        ClassPathResource resource = new ClassPathResource(MAP_SEED_RESOURCE);
        try (InputStream inputStream = resource.getInputStream()) {
            List<TarkovMapSeedItem> items = objectMapper.readValue(
                    inputStream,
                    new TypeReference<>() {
                    }
            );
            return items.stream()
                    .map(item -> new TarkovMapEntity(
                            item.nameZh(),
                            item.nameEn(),
                            item.bannerFileName(),
                            item.mapFileName(),
                            item.sortOrder()
                    ))
                    .collect(Collectors.toList());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load map seed data from " + MAP_SEED_RESOURCE, exception);
        }
    }

    private void normalizeSortOrder() {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT id FROM tarkov_map ORDER BY sort_order ASC, id ASC",
                Long.class
        );
        for (int i = 0; i < ids.size(); i++) {
            jdbcTemplate.update("UPDATE tarkov_map SET sort_order = ? WHERE id = ?", i + 1, ids.get(i));
        }
    }

    private record TarkovMapSeedItem(String nameZh,
                                     String nameEn,
                                     String bannerFileName,
                                     String mapFileName,
                                     Integer sortOrder) {
    }
}
