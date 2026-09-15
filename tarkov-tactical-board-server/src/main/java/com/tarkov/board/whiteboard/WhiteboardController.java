package com.tarkov.board.whiteboard;

import com.tarkov.board.mapintel.WhiteboardMapIntelResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/whiteboard")
@Tag(name = "Whiteboard", description = "白板实例接口")
public class WhiteboardController {

    private final WhiteboardInstanceService instanceService;

    public WhiteboardController(WhiteboardInstanceService instanceService) {
        this.instanceService = instanceService;
    }

    @PostMapping("/instances")
    @Operation(summary = "创建白板实例", description = "返回实例ID、地图ID和过期时间")
    public WhiteboardInstanceResponse createInstance(@Valid @RequestBody WhiteboardCreateInstanceRequest request) {
        return instanceService.createInstance(request.mapId());
    }

    @GetMapping("/instances/{instanceId}")
    @Operation(summary = "查询白板实例", description = "按实例ID查询是否存在")
    public WhiteboardInstanceResponse getInstance(@PathVariable String instanceId) {
        return instanceService.getInstance(instanceId);
    }

    @GetMapping("/instances/{instanceId}/state")
    @Operation(summary = "读取白板状态", description = "返回当前实例保存的画布状态")
    public WhiteboardStateResponse getState(@PathVariable String instanceId) {
        return instanceService.getState(instanceId);
    }

    @PutMapping("/instances/{instanceId}/state")
    @Operation(summary = "保存白板状态", description = "写入完整画布状态快照，并延长保留期到至少24小时")
    public WhiteboardStateResponse saveState(@PathVariable String instanceId,
                                             @Valid @RequestBody WhiteboardStateUpsertRequest request) {
        return instanceService.saveState(instanceId, request.state());
    }

    @PutMapping("/instances/{instanceId}/map")
    @Operation(summary = "切换实例地图", description = "切换实例当前地图，可选清空画布状态，并广播 map.changed 事件")
    public WhiteboardInstanceResponse switchMap(@PathVariable String instanceId,
                                                @Valid @RequestBody WhiteboardSwitchMapRequest request) {
        return instanceService.switchMap(instanceId, request.mapId(), request.shouldResetState());
    }

    @GetMapping("/instances/{instanceId}/map-intel")
    @Operation(summary = "获取地图情报", description = "返回当前实例地图的本地情报快照，包括BOSS刷新和撤离点；未同步时返回提示信息")
    public WhiteboardMapIntelResponse getMapIntel(@PathVariable String instanceId) {
        return instanceService.getMapIntel(instanceId);
    }
}
