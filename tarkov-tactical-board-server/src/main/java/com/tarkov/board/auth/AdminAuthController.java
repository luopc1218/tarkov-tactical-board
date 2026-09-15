package com.tarkov.board.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/auth")
@Tag(name = "Admin Auth", description = "管理端认证接口")
@SecurityRequirement(name = "BearerAuth")
public class AdminAuthController {

    private final AuthAdminService authAdminService;

    public AdminAuthController(AuthAdminService authAdminService) {
        this.authAdminService = authAdminService;
    }

    @PutMapping("/password")
    @Operation(summary = "修改管理员密码")
    public ChangePasswordResponse changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                 Authentication authentication) {
        String username = authentication.getName();
        authAdminService.changePassword(username, request.oldPassword(), request.newPassword());
        return new ChangePasswordResponse("Password updated");
    }
}
