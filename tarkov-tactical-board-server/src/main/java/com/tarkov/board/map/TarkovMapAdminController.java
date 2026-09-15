package com.tarkov.board.map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/maps")
@Tag(name = "Admin Map", description = "管理端地图接口")
@SecurityRequirement(name = "BearerAuth")
public class TarkovMapAdminController {

    private final TarkovMapService service;

    public TarkovMapAdminController(TarkovMapService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "管理端获取地图列表")
    public List<TarkovMapResponse> listMaps() {
        return service.listMaps();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "管理端新增地图")
    public TarkovMapResponse create(@Valid @RequestBody TarkovMapUpsertRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "管理端更新地图")
    public TarkovMapResponse update(@PathVariable Long id, @Valid @RequestBody TarkovMapUpsertRequest request) {
        return service.update(id, request);
    }

    @PutMapping("/order")
    @Operation(summary = "管理端调整地图排序")
    public List<TarkovMapResponse> reorder(@Valid @RequestBody TarkovMapReorderRequest request) {
        return service.reorder(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "管理端删除地图")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
