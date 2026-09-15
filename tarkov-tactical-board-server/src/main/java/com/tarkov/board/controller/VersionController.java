package com.tarkov.board.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

@RestController
@RequestMapping("/api/version")
public class VersionController {

    private static final String BUILD_INFO_RESOURCE = "app-build-info.properties";

    @GetMapping
    public VersionResponse version() {
        Properties buildInfo = loadBuildInfo();
        return new VersionResponse(resolveVersion(buildInfo), trimToNull(buildInfo.getProperty("build.time")));
    }

    private String resolveVersion(Properties buildInfo) {
        String version = trimToNull(buildInfo.getProperty("build.version"));
        if (version != null) {
            return version;
        }
        Package appPackage = getClass().getPackage();
        return appPackage == null ? null : trimToNull(appPackage.getImplementationVersion());
    }

    private Properties loadBuildInfo() {
        Properties properties = new Properties();
        ClassPathResource resource = new ClassPathResource(BUILD_INFO_RESOURCE);
        if (!resource.exists()) {
            return properties;
        }
        try (InputStream inputStream = resource.getInputStream()) {
            properties.load(inputStream);
        } catch (IOException ignored) {
            // Fall back to manifest values when build metadata is unreadable.
        }
        return properties;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record VersionResponse(String version, String buildTime) {
    }
}
