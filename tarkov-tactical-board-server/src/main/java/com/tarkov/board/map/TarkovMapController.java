package com.tarkov.board.map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/maps")
@Tag(name = "Map", description = "公开地图接口")
public class TarkovMapController {

    private final TarkovMapService service;

    public TarkovMapController(TarkovMapService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "获取地图列表", description = "公开接口，无需登录")
    public List<TarkovMapResponse> listMaps() {
        return service.listMaps();
    }
}
