package com.tarkov.board.whiteboard;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "whiteboard_instance")
public class WhiteboardInstanceEntity {

    @Id
    @Column(name = "instance_id", nullable = false, updatable = false, length = 64)
    private String instanceId;

    @Column(name = "map_id")
    private Long mapId;

    @Lob
    @Column(name = "state_json", columnDefinition = "LONGTEXT")
    private String stateJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "expire_at", nullable = false)
    private Instant expireAt;

    protected WhiteboardInstanceEntity() {
    }

    public WhiteboardInstanceEntity(String instanceId, Long mapId, String stateJson, Instant createdAt, Instant updatedAt, Instant expireAt) {
        this.instanceId = instanceId;
        this.mapId = mapId;
        this.stateJson = stateJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.expireAt = expireAt;
    }

    public String getInstanceId() {
        return instanceId;
    }

    public Long getMapId() {
        return mapId;
    }

    public void setMapId(Long mapId) {
        this.mapId = mapId;
    }

    public String getStateJson() {
        return stateJson;
    }

    public void setStateJson(String stateJson) {
        this.stateJson = stateJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getExpireAt() {
        return expireAt;
    }

    public void setExpireAt(Instant expireAt) {
        this.expireAt = expireAt;
    }
}
