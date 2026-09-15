package com.tarkov.board.mapintel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarkov.board.map.TarkovMapEntity;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;

@Service
public class EftarkovMapIntelService {

    private static final String EFTARKOV_BASE_URL = "https://www.eftarkov.com";
    private static final String BOSS_PAGE_URL = EFTARKOV_BASE_URL + "/news/web_208.html";
    private static final String MAP_INDEX_URL = EFTARKOV_BASE_URL + "/news/web_176.html";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    private static final int INTEL_FETCH_THREADS = 6;
    private static final Map<String, String> MAP_API_NAME_BY_ZH = Map.ofEntries(
            Map.entry("中心区", "Ground Zero"),
            Map.entry("工厂", "Factory"),
            Map.entry("海关", "Customs"),
            Map.entry("森林", "Woods"),
            Map.entry("海岸线", "Shoreline"),
            Map.entry("立交桥", "Interchange"),
            Map.entry("储备站", "Reserve"),
            Map.entry("灯塔", "Lighthouse"),
            Map.entry("塔科夫街区", "Streets of Tarkov"),
            Map.entry("实验室", "The Lab"),
            Map.entry("迷宫", "The Labyrinth"),
            Map.entry("码头", "Terminal")
    );
    private static final Map<String, List<String>> MAP_NAME_ALIASES = Map.of(
            "塔科夫街区", List.of("街区"),
            "立交桥", List.of("商场")
    );
    private static final Map<String, String> BOSS_NAME_ZH = Map.ofEntries(
            Map.entry("Shadow of Tagilla", "牛头大锤"),
            Map.entry("Tagilla", "Tagilla"),
            Map.entry("Reshala", "Reshala"),
            Map.entry("Shturman", "Shturman"),
            Map.entry("Sanitar", "Sanitar"),
            Map.entry("Killa", "Killa"),
            Map.entry("Glukhar", "Glukhar"),
            Map.entry("Zryachiy", "Zryachiy"),
            Map.entry("Kaban", "Kaban"),
            Map.entry("Kollontay", "Kollontay"),
            Map.entry("Knight", "Knight"),
            Map.entry("Partisan", "游击队"),
            Map.entry("Raider", "Raider"),
            Map.entry("Rogue", "Rogue"),
            Map.entry("Cultist Priest", "邪教徒"),
            Map.entry("AF", "AF"),
            Map.entry("Black Div.", "Black Div."),
            Map.entry("Pillager", "Pillager")
    );

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final ExecutorService intelExecutor;
    private final Map<String, CacheEntry<WhiteboardMapIntelResponse.BossRefreshInfo>> bossCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry<WhiteboardMapIntelResponse.ExtractionInfo>> extractionCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry<WhiteboardMapIntelResponse.ExtractionPointDetail>> extractionDetailCache = new ConcurrentHashMap<>();

    public EftarkovMapIntelService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.intelExecutor = Executors.newFixedThreadPool(INTEL_FETCH_THREADS);
    }

    @PreDestroy
    public void destroy() {
        intelExecutor.shutdown();
        try {
            if (!intelExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                intelExecutor.shutdownNow();
            }
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
            intelExecutor.shutdownNow();
        }
    }

    public WhiteboardMapIntelResponse.BossRefreshInfo getBossRefreshInfo(TarkovMapEntity map) {
        return getCachedValue(bossCache, map.getNameZh(), () -> fetchBossRefreshInfo(map));
    }

    public WhiteboardMapIntelResponse.ExtractionInfo getExtractionInfo(TarkovMapEntity map) {
        return getCachedValue(extractionCache, map.getNameZh(), () -> fetchExtractionInfo(map));
    }

    private WhiteboardMapIntelResponse.BossRefreshInfo fetchBossRefreshInfo(TarkovMapEntity map) {
        Instant fetchedAt = Instant.now();
        try {
            String apiMapName = MAP_API_NAME_BY_ZH.get(map.getNameZh());
            if (apiMapName == null) {
                return new WhiteboardMapIntelResponse.BossRefreshInfo(BOSS_PAGE_URL, fetchedAt, List.of(), List.of(),
                        "当前地图暂无 Boss 刷新率映射");
            }

            CompletableFuture<List<WhiteboardMapIntelResponse.BossSpawnRate>> regularFuture =
                    CompletableFuture.supplyAsync(() -> fetchBossRatesUnchecked(2, apiMapName), intelExecutor);
            CompletableFuture<List<WhiteboardMapIntelResponse.BossSpawnRate>> pveFuture =
                    CompletableFuture.supplyAsync(() -> fetchBossRatesUnchecked(1, apiMapName), intelExecutor);

            List<WhiteboardMapIntelResponse.BossSpawnRate> regular = regularFuture.join();
            List<WhiteboardMapIntelResponse.BossSpawnRate> pve = pveFuture.join();
            return new WhiteboardMapIntelResponse.BossRefreshInfo(BOSS_PAGE_URL, fetchedAt, regular, pve, null);
        } catch (Exception e) {
            return new WhiteboardMapIntelResponse.BossRefreshInfo(BOSS_PAGE_URL, fetchedAt, List.of(), List.of(),
                    "抓取 Boss 刷新率失败: " + e.getMessage());
        }
    }

    private List<WhiteboardMapIntelResponse.BossSpawnRate> fetchBossRatesUnchecked(int modeId, String apiMapName) {
        try {
            return fetchBossRatesByMode(modeId, apiMapName);
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException(e);
        }
    }

    private List<WhiteboardMapIntelResponse.BossSpawnRate> fetchBossRatesByMode(int modeId, String apiMapName) throws IOException, InterruptedException {
        String responseBody = sendRequest("https://api.eftarkov.com/boss.php?id=" + modeId, BOSS_PAGE_URL);
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode maps = root.path("raw_api_data").path("data").path("maps");
        if (!maps.isArray()) {
            return List.of();
        }

        for (JsonNode mapNode : maps) {
            if (!apiMapName.equals(mapNode.path("name").asText())) {
                continue;
            }
            LinkedHashMap<String, WhiteboardMapIntelResponse.BossSpawnRate> deduplicated = new LinkedHashMap<>();
            for (JsonNode bossNode : mapNode.path("bosses")) {
                String bossName = bossNode.path("name").asText();
                deduplicated.computeIfAbsent(bossName, key -> new WhiteboardMapIntelResponse.BossSpawnRate(
                        key,
                        BOSS_NAME_ZH.getOrDefault(key, key),
                        toPercent(bossNode.path("spawnChance").asDouble())
                ));
            }
            return List.copyOf(deduplicated.values());
        }
        return List.of();
    }

    private WhiteboardMapIntelResponse.ExtractionInfo fetchExtractionInfo(TarkovMapEntity map) {
        Instant fetchedAt = Instant.now();
        try {
            Document indexDocument = getDocument(MAP_INDEX_URL, MAP_INDEX_URL);
            String mapDetailUrl = resolveMapDetailUrl(indexDocument, map.getNameZh());
            if (mapDetailUrl == null) {
                return new WhiteboardMapIntelResponse.ExtractionInfo(MAP_INDEX_URL, fetchedAt, List.of(),
                        "未找到当前地图的撤离点详情页");
            }

            Document detailDocument = getDocument(mapDetailUrl, MAP_INDEX_URL);
            Element extractionTable = findExtractionTable(detailDocument);
            if (extractionTable == null) {
                return new WhiteboardMapIntelResponse.ExtractionInfo(mapDetailUrl, fetchedAt, List.of(),
                        "地图详情页中未找到撤离点表格");
            }

            List<CompletableFuture<WhiteboardMapIntelResponse.ExtractionPoint>> pointFutures = new ArrayList<>();
            Elements rows = extractionTable.select("tr");
            for (int i = 1; i < rows.size(); i++) {
                Elements cells = rows.get(i).select("td");
                if (cells.size() < 3) {
                    continue;
                }

                Element nameCell = cells.get(0);
                Element link = nameCell.selectFirst("a[href]");
                String detailUrl = link == null ? null : toAbsoluteUrl(link.attr("href"));
                String name = normalizeWhitespace(nameCell.text());
                String faction = normalizeWhitespace(cells.get(1).text());
                String requirement = normalizeWhitespace(cells.get(2).text());
                pointFutures.add(CompletableFuture.supplyAsync(
                        () -> buildExtractionPoint(name, faction, requirement, detailUrl),
                        intelExecutor
                ));
            }

            List<WhiteboardMapIntelResponse.ExtractionPoint> points = pointFutures.stream()
                    .map(CompletableFuture::join)
                    .toList();
            return new WhiteboardMapIntelResponse.ExtractionInfo(mapDetailUrl, fetchedAt, points, null);
        } catch (Exception e) {
            return new WhiteboardMapIntelResponse.ExtractionInfo(MAP_INDEX_URL, fetchedAt, List.of(),
                    "抓取撤离点失败: " + e.getMessage());
        }
    }

    private WhiteboardMapIntelResponse.ExtractionPoint buildExtractionPoint(String name,
                                                                            String faction,
                                                                            String requirement,
                                                                            String detailUrl) {
        WhiteboardMapIntelResponse.ExtractionPointDetail detail = detailUrl == null
                ? null
                : getCachedValue(extractionDetailCache, detailUrl, () -> fetchExtractionPointDetail(detailUrl));
        return new WhiteboardMapIntelResponse.ExtractionPoint(
                name,
                faction,
                requirement,
                detailUrl,
                detail
        );
    }

    private WhiteboardMapIntelResponse.ExtractionPointDetail fetchExtractionPointDetail(String detailUrl) throws IOException, InterruptedException {
        Document document = getDocument(detailUrl, detailUrl);
        Element introTable = findIntroTable(document);
        Map<String, String> fields = new LinkedHashMap<>();
        if (introTable != null) {
            for (Element row : introTable.select("tr")) {
                Elements cells = row.select("td");
                if (cells.size() != 2) {
                    continue;
                }
                fields.put(normalizeWhitespace(cells.get(0).text()), normalizeWhitespace(cells.get(1).text()));
            }
        }

        LinkedHashSet<String> imageUrls = new LinkedHashSet<>();
        for (Element link : document.select("article.newsContent #copy a[href]")) {
            String href = link.attr("href");
            if (href == null || href.isBlank()) {
                continue;
            }
            if (href.contains(".webp") || href.contains(".png") || href.contains(".jpg") || href.contains(".jpeg")) {
                imageUrls.add(toAbsoluteUrl(href));
            }
        }

        return new WhiteboardMapIntelResponse.ExtractionPointDetail(
                fields.get("地图"),
                fields.get("阵营"),
                fields.get("要求"),
                toBoolean(fields.get("始终可用")),
                toBoolean(fields.get("一次性撤离点")),
                List.copyOf(imageUrls)
        );
    }

    private Element findExtractionTable(Document document) {
        for (Element table : document.select("article.newsContent table")) {
            String text = normalizeWhitespace(table.text());
            if (text.contains("撤离点名称") && text.contains("阵营") && text.contains("要求")) {
                return table;
            }
        }
        return null;
    }

    private Element findIntroTable(Document document) {
        for (Element table : document.select("article.newsContent table")) {
            if (normalizeWhitespace(table.text()).contains("撤离点简介")) {
                return table;
            }
        }
        return null;
    }

    private String resolveMapDetailUrl(Document document, String mapNameZh) {
        Set<String> candidateNames = new LinkedHashSet<>();
        candidateNames.add(mapNameZh);
        candidateNames.addAll(MAP_NAME_ALIASES.getOrDefault(mapNameZh, List.of()));

        for (Element link : document.select("article.newsContent a[href^=/news/web_]")) {
            String text = normalizeWhitespace(link.text());
            if (candidateNames.contains(text)) {
                return toAbsoluteUrl(link.attr("href"));
            }
        }
        return null;
    }

    private Document getDocument(String url, String referer) throws IOException, InterruptedException {
        return Jsoup.parse(sendRequest(url, referer), url);
    }

    private String sendRequest(String url, String referer) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("User-Agent", "Mozilla/5.0")
                .header("Referer", referer)
                .header("Origin", EFTARKOV_BASE_URL)
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("HTTP " + response.statusCode() + " for " + url);
        }
        return response.body();
    }

    private <T> T getCachedValue(Map<String, CacheEntry<T>> cache, String key, ThrowingSupplier<T> supplier) {
        CacheEntry<T> cached = cache.get(key);
        Instant now = Instant.now();
        if (cached != null && cached.expireAt().isAfter(now)) {
            return cached.value();
        }
        try {
            T value = supplier.get();
            cache.put(key, new CacheEntry<>(value, now.plus(CACHE_TTL)));
            return value;
        } catch (Exception e) {
            if (cached != null) {
                return cached.value();
            }
            throw new IllegalStateException(e);
        }
    }

    private String toPercent(double value) {
        return Math.round(value * 100) + "%";
    }

    private Boolean toBoolean(String rawValue) {
        if (rawValue == null) {
            return null;
        }
        if (rawValue.contains("✔")) {
            return true;
        }
        if (rawValue.contains("✘")) {
            return false;
        }
        return null;
    }

    private String normalizeWhitespace(String value) {
        if (value == null) {
            return null;
        }
        return value.replace('\u00A0', ' ')
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String toAbsoluteUrl(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
        }
        if (url.startsWith("/")) {
            return EFTARKOV_BASE_URL + url;
        }
        return EFTARKOV_BASE_URL + "/" + URLEncoder.encode(url, StandardCharsets.UTF_8);
    }

    private record CacheEntry<T>(T value, Instant expireAt) {
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
