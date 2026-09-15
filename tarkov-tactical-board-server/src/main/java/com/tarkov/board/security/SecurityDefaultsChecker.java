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

    private static final String DEFAULT_DATASOURCE_PASSWORD = "Peichun@92755";
    private static final String DEFAULT_ADMIN_PASSWORD_HASH = "$2y$10$OTn77oohWpGwKB8hMYFLW.WJ1MxaFRr6.AF7O16CUxFmjDxgWre2O";
    private static final String DEFAULT_JWT_SECRET = "QWJjREVmZ0hpSmtMbW5PcFFyU3RVdld4WXowMTIzNDU2Nzg5Kys=";

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
        if (DEFAULT_DATASOURCE_PASSWORD.equals(datasourcePassword)) {
            log.warn("Security warning: default datasource password is in use. Set SPRING_DATASOURCE_PASSWORD.");
        }
        if (DEFAULT_ADMIN_PASSWORD_HASH.equals(authProperties.getAdminPasswordHash())) {
            log.warn("Security warning: default admin password hash is in use. Set APP_AUTH_ADMINPASSWORDHASH.");
        }
        if (DEFAULT_JWT_SECRET.equals(jwtProperties.getSecret())) {
            log.warn("Security warning: default JWT secret is in use. Set APP_JWT_SECRET.");
        }
    }
}
