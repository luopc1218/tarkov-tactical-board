package com.tarkov.board.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AuthAdminService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final AuthAdminRepository repository;
    private final PasswordEncoder passwordEncoder;

    public AuthAdminService(AuthAdminRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public boolean verifyCredentials(String username, String plainPassword) {
        return repository.findByUsername(username)
                .map(admin -> passwordEncoder.matches(plainPassword, admin.getPasswordHash()))
                .orElse(false);
    }

    @Transactional
    public void changePassword(String username, String oldPassword, String newPassword) {
        AuthAdminEntity admin = repository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Admin user not found"));

        if (!passwordEncoder.matches(oldPassword, admin.getPasswordHash())) {
            throw new ResponseStatusException(UNAUTHORIZED, "Old password is incorrect");
        }
        validateNewPassword(oldPassword, newPassword);

        admin.setPasswordHash(passwordEncoder.encode(newPassword));
        admin.setUpdatedAt(Instant.now());
        repository.save(admin);
    }

    private void validateNewPassword(String oldPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(BAD_REQUEST, "New password must be at least 8 characters");
        }
        if (newPassword.equals(oldPassword)) {
            throw new ResponseStatusException(BAD_REQUEST, "New password must be different from old password");
        }
    }
}
