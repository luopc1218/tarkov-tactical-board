package com.tarkov.board.map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "tarkov_map")
public class TarkovMapEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name_zh", nullable = false, length = 128)
    private String nameZh;

    @Column(name = "name_en", nullable = false, length = 128)
    private String nameEn;

    @Column(name = "banner_file_name", length = 2048)
    private String bannerFileName;

    @Column(name = "map_file_name", length = 2048)
    private String mapFileName;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    protected TarkovMapEntity() {
    }

    public TarkovMapEntity(String nameZh, String nameEn, String bannerFileName, String mapFileName) {
        this(nameZh, nameEn, bannerFileName, mapFileName, 0);
    }

    public TarkovMapEntity(String nameZh, String nameEn, String bannerFileName, String mapFileName, Integer sortOrder) {
        this.nameZh = nameZh;
        this.nameEn = nameEn;
        this.bannerFileName = bannerFileName;
        this.mapFileName = mapFileName;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public String getNameZh() {
        return nameZh;
    }

    public void setNameZh(String nameZh) {
        this.nameZh = nameZh;
    }

    public String getNameEn() {
        return nameEn;
    }

    public void setNameEn(String nameEn) {
        this.nameEn = nameEn;
    }

    public String getBannerFileName() {
        return bannerFileName;
    }

    public void setBannerFileName(String bannerFileName) {
        this.bannerFileName = bannerFileName;
    }

    public String getMapFileName() {
        return mapFileName;
    }

    public void setMapFileName(String mapFileName) {
        this.mapFileName = mapFileName;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
