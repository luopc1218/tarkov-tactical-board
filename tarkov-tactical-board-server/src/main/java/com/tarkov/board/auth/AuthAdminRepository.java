package com.tarkov.board.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthAdminRepository extends JpaRepository<AuthAdminEntity, Long> {

    Optional<AuthAdminEntity> findByUsername(String username);

    boolean existsByUsername(String username);
}
