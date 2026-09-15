package com.tarkov.board.map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record TarkovMapReorderRequest(
        @NotEmpty List<@NotNull Long> mapIds
) {
}
