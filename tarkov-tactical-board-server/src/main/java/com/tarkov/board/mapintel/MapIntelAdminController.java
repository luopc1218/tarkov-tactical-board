package com.tarkov.board.mapintel;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/map-intel")
@Tag(name = "Admin Map Intel", description = "管理端地图情报同步接口")
@SecurityRequirement(name = "BearerAuth")
public class MapIntelAdminController {

    private final MapIntelSnapshotService snapshotService;

    public MapIntelAdminController(MapIntelSnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @GetMapping("/maps")
    @Operation(summary = "管理端获取全部地图情报快照状态")
    public List<MapIntelSyncResponse> listMapIntelSnapshots() {
        return snapshotService.listAdminSnapshots();
    }

    @GetMapping("/maps/{mapId}")
    @Operation(summary = "管理端获取地图情报快照")
    public MapIntelSyncResponse getMapIntelSnapshot(@PathVariable Long mapId) {
        return snapshotService.getAdminSnapshot(mapId);
    }

    @PostMapping("/maps/{mapId}/sync")
    @Operation(summary = "管理端手动同步单张地图情报")
    public MapIntelSyncResponse syncMapIntel(@PathVariable Long mapId) {
        return snapshotService.syncMap(mapId);
    }

    @PostMapping("/sync-all")
    @Operation(summary = "管理端手动同步全部地图情报")
    public List<MapIntelSyncResponse> syncAllMapIntel() {
        return snapshotService.syncAllMaps();
    }
}
