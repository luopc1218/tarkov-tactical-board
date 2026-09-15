package com.tarkov.board.mapintel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "map_intel_snapshot")
public class MapIntelSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false, unique = true)
    private Long mapId;

    @Column(name = "map_name_zh", nullable = false, length = 128)
    private String mapNameZh;

    @Column(name = "map_name_en", nullable = false, length = 128)
    private String mapNameEn;

    @Lob
    @Column(name = "boss_refresh_json", columnDefinition = "LONGTEXT")
    private String bossRefreshJson;

    @Lob
    @Column(name = "extractions_json", columnDefinition = "LONGTEXT")
    private String extractionsJson;

    @Column(name = "synced_at")
    private Instant syncedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MapIntelSnapshotEntity() {
    }

    public MapIntelSnapshotEntity(Long mapId,
                                  String mapNameZh,
                                  String mapNameEn,
                                  String bossRefreshJson,
                                  String extractionsJson,
                                  Instant syncedAt,
                                  Instant createdAt,
                                  Instant updatedAt) {
        this.mapId = mapId;
        this.mapNameZh = mapNameZh;
        this.mapNameEn = mapNameEn;
        this.bossRefreshJson = bossRefreshJson;
        this.extractionsJson = extractionsJson;
        this.syncedAt = syncedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getMapId() {
        return mapId;
    }

    public void setMapId(Long mapId) {
        this.mapId = mapId;
    }

    public String getMapNameZh() {
        return mapNameZh;
    }

    public void setMapNameZh(String mapNameZh) {
        this.mapNameZh = mapNameZh;
    }

    public String getMapNameEn() {
        return mapNameEn;
    }

    public void setMapNameEn(String mapNameEn) {
        this.mapNameEn = mapNameEn;
    }

    public String getBossRefreshJson() {
        return bossRefreshJson;
    }

    public void setBossRefreshJson(String bossRefreshJson) {
        this.bossRefreshJson = bossRefreshJson;
    }

    public String getExtractionsJson() {
        return extractionsJson;
    }

    public void setExtractionsJson(String extractionsJson) {
        this.extractionsJson = extractionsJson;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(Instant syncedAt) {
        this.syncedAt = syncedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
