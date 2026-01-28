"""Login endpoint tests."""
import pytest
from jose import jwt
from app.config import get_settings


class TestLogin:

    def test_login_success_returns_tokens_and_user(
        self, client, tenant_with_admin,
    ):
        tenant, hq, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "tokens" in data
        assert data["tokens"]["access_token"]
        assert data["tokens"]["refresh_token"]
        assert data["user"]["email"] == admin.email
        assert data["tenant"] is not None
        assert data["tenant"]["subdomain"] == tenant.subdomain

    def test_login_wrong_password_returns_401(
        self, client, tenant_with_admin,
    ):
        _, _, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "WrongPassword1",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email_returns_401(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "Test1234",
        })
        assert resp.status_code == 401

    def test_login_inactive_user_returns_401(
        self, client, tenant_with_admin, create_user,
    ):
        tenant, hq, _ = tenant_with_admin
        inactive = create_user(
            tenant_id=tenant.id, is_active=False,
            email="inactive@test.com",
        )
        resp = client.post("/api/v1/auth/login", json={
            "email": inactive.email,
            "password": "Test1234",
        })
        assert resp.status_code == 401

    def test_super_admin_login_returns_tenant_null(
        self, client, super_admin,
    ):
        resp = client.post("/api/v1/auth/login", json={
            "email": super_admin.email,
            "password": "Test1234",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant"] is None

    def test_jwt_contains_correct_claims(
        self, client, tenant_with_admin,
    ):
        tenant, _, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
        })
        token = resp.json()["tokens"]["access_token"]
        settings = get_settings()
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == str(admin.id)
        assert payload["role"] == "admin"
        assert payload["tenant_id"] == str(tenant.id)

    def test_login_with_tenant_subdomain(
        self, client, tenant_with_admin,
    ):
        tenant, _, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
            "tenant_subdomain": tenant.subdomain,
        })
        assert resp.status_code == 200
        assert resp.json()["tenant"]["subdomain"] == tenant.subdomain

    def test_login_with_wrong_subdomain_returns_404(
        self, client, tenant_with_admin,
    ):
        _, _, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/login", json={
            "email": admin.email,
            "password": "Test1234",
            "tenant_subdomain": "nonexistent-sub",
        })
        assert resp.status_code == 404
