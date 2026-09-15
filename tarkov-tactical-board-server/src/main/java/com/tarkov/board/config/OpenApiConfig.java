package com.tarkov.board.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "Tarkov Tactical Board Server API",
                version = "v1",
                description = "Backend APIs for tactical board",
                contact = @Contact(name = "Backend Team")
        )
)
@SecurityScheme(
        name = "BearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        in = SecuritySchemeIn.HEADER,
        description = "使用 /api/auth/login 获取 token，在 Authorize 中填写：Bearer <token>"
)
public class OpenApiConfig {

    @Bean
    public OpenApiCustomizer adminAuthorizationCustomizer() {
        return openApi -> {
            if (openApi.getPaths() == null) {
                return;
            }

            openApi.getPaths().forEach((path, pathItem) -> {
                if (!path.startsWith("/api/admin/")) {
                    return;
                }

                pathItem.readOperations().forEach(operation -> {
                    if (operation.getSecurity() == null) {
                        operation.setSecurity(new ArrayList<>());
                    }

                    boolean hasBearerAuth = operation.getSecurity().stream()
                            .anyMatch(item -> item.containsKey("BearerAuth"));
                    if (!hasBearerAuth) {
                        operation.addSecurityItem(new SecurityRequirement().addList("BearerAuth"));
                    }
                });
            });
        };
    }
}
