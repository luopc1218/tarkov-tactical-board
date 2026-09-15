package com.tarkov.board.whiteboard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WhiteboardInstanceRepository extends JpaRepository<WhiteboardInstanceEntity, String> {

    Optional<WhiteboardInstanceEntity> findByInstanceIdAndExpireAtAfter(String instanceId, Instant now);

    boolean existsByInstanceIdAndExpireAtAfter(String instanceId, Instant now);

    List<WhiteboardInstanceEntity> findAllByOrderByCreatedAtDesc();

    List<WhiteboardInstanceEntity> findAllByOrderByCreatedAtAsc(Pageable pageable);

    List<WhiteboardInstanceEntity> findByExpireAtAfterOrderByCreatedAtDesc(Instant now);

    Page<WhiteboardInstanceEntity> findByExpireAtAfter(Instant now, Pageable pageable);

    boolean existsByInstanceId(String instanceId);

    @Modifying
    @Query("""
            UPDATE WhiteboardInstanceEntity i
            SET i.expireAt = :newExpireAt
            WHERE i.instanceId = :instanceId AND i.expireAt > :now
            """)
    int touchExpireAtIfActive(@Param("instanceId") String instanceId,
                              @Param("now") Instant now,
                              @Param("newExpireAt") Instant newExpireAt);

    @Modifying
    @Query("DELETE FROM WhiteboardInstanceEntity i WHERE i.expireAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
