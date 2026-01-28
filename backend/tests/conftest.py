"""
Core test fixtures for Harmony SaaS backend testing.

Uses PostgreSQL test database with transaction rollback per test for isolation and speed.
Set TEST_DATABASE_URL env var or defaults to postgresql://postgres:postgres@localhost:5432/harmony_test
"""
import os
import uuid

# Set environment variables BEFORE any app imports
os.environ.setdefault("DATABASE_URL", os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://postgres:qwer1234@localhost:5433/harmony_test"
))
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("MAIL_ENABLED", "False")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")  # Use DB 15 for tests

# Clear cached settings so our env vars take effect
from app.config import get_settings
get_settings.cache_clear()

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.models.user import User
from app.main import app


# ---------------------------------------------------------------------------
# Database engine & table setup (session-scoped)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = os.environ["DATABASE_URL"].replace(
    "postgresql://", "postgresql+psycopg://"
)


@pytest.fixture(scope="session")
def engine():
    """Create test database engine, create all tables, tear down after session."""
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture(scope="session")
def _session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Per-test database session with savepoint rollback
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session(engine, _session_factory) -> Session:
    """
    Provide a transactional database session that rolls back after each test.

    Uses the nested transaction (savepoint) pattern so that even code calling
    session.commit() inside the application will not persist data.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = _session_factory(bind=connection)

    # Start a savepoint
    nested = connection.begin_nested()

    # Whenever the application calls session.commit(), restart the savepoint
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session, trans):
        nonlocal nested
        if trans.nested and not trans._parent.nested:
            nested = connection.begin_nested()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# FastAPI test clients
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db_session) -> TestClient:
    """Synchronous FastAPI test client with DB override."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
async def async_client(db_session) -> AsyncClient:
    """Async httpx test client for async endpoint tests."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def create_tenant(db_session):
    """Factory fixture to create a tenant."""
    def _create(
        name: str = "Test Tenant",
        subdomain: str | None = None,
        tier: str = "free",
        max_users: int = 5,
        max_branches: int = 1,
        is_active: bool = True,
    ) -> Tenant:
        tenant = Tenant(
            name=name,
            subdomain=subdomain or f"test-{uuid.uuid4().hex[:8]}",
            tier=tier,
            subscription_status="active",
            max_users=max_users,
            max_branches=max_branches,
            max_storage_gb=1,
            is_active=is_active,
            features={},
            settings={},
            meta_data={},
        )
        db_session.add(tenant)
        db_session.flush()
        return tenant
    return _create


@pytest.fixture()
def create_branch(db_session):
    """Factory fixture to create a branch."""
    def _create(
        tenant_id: uuid.UUID,
        name: str = "Test Branch",
        code: str | None = None,
        is_hq: bool = False,
    ) -> Branch:
        branch = Branch(
            tenant_id=tenant_id,
            name=name,
            code=code or f"BR-{uuid.uuid4().hex[:6].upper()}",
            is_hq=is_hq,
            is_active=True,
        )
        db_session.add(branch)
        db_session.flush()
        return branch
    return _create


@pytest.fixture()
def create_user(db_session):
    """Factory fixture to create a user."""
    def _create(
        tenant_id: uuid.UUID | None = None,
        email: str | None = None,
        password: str = "Test1234",
        role: str = "staff",
        first_name: str = "Test",
        last_name: str = "User",
        is_super_admin: bool = False,
        default_branch_id: uuid.UUID | None = None,
        is_active: bool = True,
        is_verified: bool = True,
    ) -> User:
        user = User(
            tenant_id=tenant_id,
            email=email or f"user-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=get_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            full_name=f"{first_name} {last_name}",
            role=role,
            is_super_admin=is_super_admin,
            default_branch_id=default_branch_id,
            is_active=is_active,
            is_verified=is_verified,
        )
        db_session.add(user)
        db_session.flush()
        return user
    return _create


# ---------------------------------------------------------------------------
# Composite fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_with_admin(create_tenant, create_branch, create_user):
    """Create a tenant with HQ branch and admin user. Returns (tenant, branch, admin)."""
    tenant = create_tenant()
    hq = create_branch(tenant_id=tenant.id, name="Head Office", code="HQ", is_hq=True)
    admin = create_user(
        tenant_id=tenant.id,
        role="admin",
        email=f"admin-{uuid.uuid4().hex[:8]}@test.com",
        default_branch_id=hq.id,
    )
    return tenant, hq, admin


@pytest.fixture()
def super_admin(create_user):
    """Create a super admin user (no tenant)."""
    return create_user(
        tenant_id=None,
        role="super_admin",
        is_super_admin=True,
        email=f"superadmin-{uuid.uuid4().hex[:8]}@test.com",
        first_name="Super",
        last_name="Admin",
    )


@pytest.fixture()
def two_tenants(create_tenant, create_branch, create_user):
    """
    Create two separate tenants, each with HQ + admin.
    Returns (tenant_a, admin_a, tenant_b, admin_b).
    """
    tenant_a = create_tenant(name="Tenant A", subdomain="tenant-a")
    hq_a = create_branch(tenant_id=tenant_a.id, name="HQ A", code="HQ", is_hq=True)
    admin_a = create_user(
        tenant_id=tenant_a.id, role="admin",
        email="admin-a@test.com", default_branch_id=hq_a.id,
    )

    tenant_b = create_tenant(name="Tenant B", subdomain="tenant-b")
    hq_b = create_branch(tenant_id=tenant_b.id, name="HQ B", code="HQ", is_hq=True)
    admin_b = create_user(
        tenant_id=tenant_b.id, role="admin",
        email="admin-b@test.com", default_branch_id=hq_b.id,
    )

    return tenant_a, admin_a, tenant_b, admin_b


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def auth_headers():
    """Factory to generate Authorization headers for a user."""
    def _headers(user: User) -> dict:
        token_data = {
            "sub": str(user.id),
            "role": user.role,
        }
        if user.tenant_id:
            token_data["tenant_id"] = str(user.tenant_id)
        token = create_access_token(token_data)
        return {"Authorization": f"Bearer {token}"}
    return _headers


# ---------------------------------------------------------------------------
# Autouse fixtures: disable email and rate limiting
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def mock_email_service(monkeypatch):
    """Prevent any real email sending during tests."""
    from app.services import email_service as email_mod

    async def _noop(*args, **kwargs):
        pass

    if hasattr(email_mod, "email_service"):
        svc = email_mod.email_service
        for method_name in dir(svc):
            if method_name.startswith("send_"):
                monkeypatch.setattr(svc, method_name, _noop)


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Override rate limit dependencies to no-ops for all tests."""
    from app.middleware.rate_limiter import (
        auth_rate_limit, strict_rate_limit, api_rate_limit, relaxed_rate_limit,
    )

    async def _noop(request=None):
        pass

    app.dependency_overrides[auth_rate_limit] = _noop
    app.dependency_overrides[strict_rate_limit] = _noop
    app.dependency_overrides[api_rate_limit] = _noop
    app.dependency_overrides[relaxed_rate_limit] = _noop
    yield
    # Don't clear here — client fixture handles clearing
