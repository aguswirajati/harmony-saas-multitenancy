"""Registration endpoint tests."""
import pytest


class TestRegister:

    def test_register_creates_tenant_and_owner(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "company_name": "Acme Corp",
            "subdomain": "acmecorp",
            "admin_email": "admin@acmecorp.com",
            "admin_password": "SecurePass1",
            "admin_name": "Jane Doe",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["message"] == "Registration successful"
        assert data["tenant"]["subdomain"] == "acmecorp"
        assert data["user"]["email"] == "admin@acmecorp.com"
        assert data["user"]["role"] == "owner"  # Registration creates owner
        assert data["user"]["tenant_role"] == "owner"
        assert data["tokens"]["access_token"]
        assert data["tokens"]["refresh_token"]

    def test_register_duplicate_subdomain_rejected(self, client, tenant_with_admin):
        tenant, _, _ = tenant_with_admin
        resp = client.post("/api/v1/auth/register", json={
            "company_name": "Dup Co",
            "subdomain": tenant.subdomain,
            "admin_email": "unique@dup.com",
            "admin_password": "SecurePass1",
            "admin_name": "Dup Admin",
        })
        assert resp.status_code == 400
        assert "subdomain" in resp.json()["detail"].lower() or "Subdomain" in resp.json()["detail"]

    def test_register_duplicate_email_rejected(self, client, tenant_with_admin):
        _, _, admin = tenant_with_admin
        resp = client.post("/api/v1/auth/register", json={
            "company_name": "New Co",
            "subdomain": "newco-unique",
            "admin_email": admin.email,
            "admin_password": "SecurePass1",
            "admin_name": "New Admin",
        })
        assert resp.status_code == 400
        assert "email" in resp.json()["detail"].lower() or "Email" in resp.json()["detail"]

    def test_register_returns_valid_tokens(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "company_name": "Token Corp",
            "subdomain": "tokencorp",
            "admin_email": "admin@tokencorp.com",
            "admin_password": "SecurePass1",
            "admin_name": "Token Admin",
        })
        assert resp.status_code == 201
        tokens = resp.json()["tokens"]

        # Verify tokens work by calling /auth/me
        me_resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "admin@tokencorp.com"

    def test_register_weak_password_rejected(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "company_name": "Weak Co",
            "subdomain": "weakco",
            "admin_email": "admin@weakco.com",
            "admin_password": "short",
            "admin_name": "Weak Admin",
        })
        assert resp.status_code == 422  # Validation error
