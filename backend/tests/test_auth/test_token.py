"""Token refresh endpoint tests."""
import pytest
from datetime import timedelta
from jose import jwt
from app.core.security import create_refresh_token
from app.config import get_settings


class TestTokenRefresh:

    def test_refresh_returns_new_tokens(self, client, tenant_with_admin):
        tenant, _, admin = tenant_with_admin

        # Login first to get a valid refresh token
        login_resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
        })
        refresh_token = login_resp.json()["tokens"]["refresh_token"]

        # Refresh
        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"

        # Verify the new access token works
        me_resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        assert me_resp.status_code == 200

    def test_refresh_with_invalid_token_returns_401(self, client):
        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid.token.here",
        })
        assert resp.status_code == 401

    def test_refresh_with_expired_token_returns_401(self, client, tenant_with_admin):
        _, _, admin = tenant_with_admin

        # Create an already-expired refresh token
        settings = get_settings()
        expired_token = jwt.encode(
            {"sub": str(admin.id), "role": admin.role, "exp": 0},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": expired_token,
        })
        assert resp.status_code == 401

    def test_refreshed_token_works_for_auth(self, client, tenant_with_admin):
        _, _, admin = tenant_with_admin

        # Login
        login_resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
        })
        refresh_token = login_resp.json()["tokens"]["refresh_token"]

        # Refresh
        refresh_resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        new_access = refresh_resp.json()["access_token"]

        # Use the new access token
        me_resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_access}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == admin.email
