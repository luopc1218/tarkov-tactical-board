package com.tarkov.board.map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TarkovMapUpsertRequest(
        @NotBlank @Size(max = 128) String nameZh,
        @NotBlank @Size(max = 128) String nameEn,
        @NotBlank @Size(max = 2048) @Pattern(regexp = "(?i)^https?://.+", message = "must be an HTTP(S) URL") String bannerFileName,
        @NotBlank @Size(max = 2048) @Pattern(regexp = "(?i)^https?://.+", message = "must be an HTTP(S) URL") String mapFileName
) {
}
