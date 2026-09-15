package com.tarkov.board.auth;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class AuthAdminInitializer {

    private final JdbcTemplate jdbcTemplate;
    private final AuthAdminRepository repository;
    private final AuthProperties authProperties;

    public AuthAdminInitializer(JdbcTemplate jdbcTemplate,
                                AuthAdminRepository repository,
                                AuthProperties authProperties) {
        this.jdbcTemplate = jdbcTemplate;
        this.repository = repository;
        this.authProperties = authProperties;
    }

    @PostConstruct
    public void init() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS auth_admin (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(64) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at DATETIME(3) NOT NULL,
                    updated_at DATETIME(3) NOT NULL
                )
                """);
        seedDefaultAdminIfMissing();
    }

    private void seedDefaultAdminIfMissing() {
        String username = authProperties.getAdminUsername();
        if (repository.findByUsername(username).isPresent()) {
            return;
        }

        Instant now = Instant.now();
        AuthAdminEntity admin = new AuthAdminEntity(
                username,
                authProperties.getAdminPasswordHash(),
                now,
                now
        );
        repository.save(admin);
    }
}
