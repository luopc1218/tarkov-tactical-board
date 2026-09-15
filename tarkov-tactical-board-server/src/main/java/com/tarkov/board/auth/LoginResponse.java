package com.tarkov.board.auth;

public record LoginResponse(String tokenType, String accessToken, long expireSeconds) {
}
