package com.tarkov.board.whiteboard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/whiteboard/instances")
@Tag(name = "Admin Whiteboard", description = "管理端白板实例接口")
@SecurityRequirement(name = "BearerAuth")
public class WhiteboardAdminController {

    private final WhiteboardInstanceService instanceService;

    public WhiteboardAdminController(WhiteboardInstanceService instanceService) {
        this.instanceService = instanceService;
    }

    @GetMapping
    @Operation(summary = "管理端实例列表")
    public List<WhiteboardAdminInstanceResponse> listInstances(
            @Parameter(description = "是否包含已过期实例，默认 true")
            @RequestParam(defaultValue = "true") boolean includeExpired,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(name = "current", required = false) Integer current,
            @RequestParam(name = "pageSize", required = false) Integer pageSize) {
        // Prefer 1-based current/pageSize when both naming styles are present from the frontend.
        Integer resolvedPage = current != null ? current - 1 : page;
        Integer resolvedSize = pageSize != null ? pageSize : size;
        return instanceService.listInstances(includeExpired, resolvedPage, resolvedSize);
    }

    @DeleteMapping("/{instanceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "管理端删除实例")
    public void deleteInstance(@PathVariable String instanceId) {
        instanceService.deleteInstance(instanceId);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "管理端清空所有实例")
    public void clearAllInstances() {
        instanceService.clearAllInstances();
    }
}
