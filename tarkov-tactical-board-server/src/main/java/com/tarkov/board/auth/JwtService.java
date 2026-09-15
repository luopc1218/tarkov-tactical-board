package com.tarkov.board.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final JwtProperties jwtProperties;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    public String createToken(String username) {
        Instant now = Instant.now();
        Instant expireAt = now.plusSeconds(jwtProperties.getExpireSeconds());

        return Jwts.builder()
                .subject(username)
                .claim("role", "ADMIN")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expireAt))
                .signWith(secretKey())
                .compact();
    }

    public String parseUsername(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    private SecretKey secretKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtProperties.getSecret()));
    }
}
