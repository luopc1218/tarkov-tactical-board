package com.tarkov.board.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "认证接口")
public class AuthController {

    private final JwtProperties jwtProperties;
    private final JwtService jwtService;
    private final AuthAdminService authAdminService;

    public AuthController(JwtProperties jwtProperties,
                          JwtService jwtService,
                          AuthAdminService authAdminService) {
        this.jwtProperties = jwtProperties;
        this.jwtService = jwtService;
        this.authAdminService = authAdminService;
    }

    @PostMapping("/login")
    @Operation(summary = "管理端登录", description = "使用管理账号密码获取 JWT")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        boolean passwordMatched = authAdminService.verifyCredentials(request.username(), request.password());

        if (!passwordMatched) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthErrorResponse("AUTH_FAILED", "用户名或密码错误"));
        }

        String token = jwtService.createToken(request.username());
        return ResponseEntity.ok(new LoginResponse("Bearer", token, jwtProperties.getExpireSeconds()));
    }
}
