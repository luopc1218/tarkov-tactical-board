package com.tarkov.board.security;

import com.tarkov.board.auth.AuthProperties;
import com.tarkov.board.auth.JwtProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SecurityDefaultsChecker {

    private static final Logger log = LoggerFactory.getLogger(SecurityDefaultsChecker.class);

    private static final String INSECURE_DATASOURCE_PASSWORD = "root";

    private final AuthProperties authProperties;
    private final JwtProperties jwtProperties;
    private final String datasourcePassword;

    public SecurityDefaultsChecker(AuthProperties authProperties,
                                   JwtProperties jwtProperties,
                                   @Value("${spring.datasource.password:}") String datasourcePassword) {
        this.authProperties = authProperties;
        this.jwtProperties = jwtProperties;
        this.datasourcePassword = datasourcePassword;
    }

    @PostConstruct
    public void warnIfUsingInsecureDefaults() {
        if (datasourcePassword == null
                || datasourcePassword.isBlank()
                || INSECURE_DATASOURCE_PASSWORD.equals(datasourcePassword)) {
            log.warn("Security warning: datasource password is missing or insecure. Set SPRING_DATASOURCE_PASSWORD.");
        }
        if (authProperties.getAdminPasswordHash() == null || authProperties.getAdminPasswordHash().isBlank()) {
            log.warn("Security warning: admin password hash is not configured. Set APP_AUTH_ADMINPASSWORDHASH.");
        }
        if (jwtProperties.getSecret() == null || jwtProperties.getSecret().isBlank()) {
            log.warn("Security warning: JWT secret is not configured. Set APP_JWT_SECRET.");
        }
    }
}
