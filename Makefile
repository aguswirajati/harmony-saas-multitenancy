.PHONY: help dev up down build test test-cov lint migrate backup restore clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

up: ## Start all services with Docker Compose
	docker compose up -d

dev: ## Start with hot-reload (development mode)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

down: ## Stop all services
	docker compose down

down-v: ## Stop all services and remove volumes (reset DB)
	docker compose down -v

build: ## Rebuild all Docker images
	docker compose build

logs: ## Tail logs from all services
	docker compose logs -f

logs-backend: ## Tail backend logs
	docker compose logs -f backend

logs-frontend: ## Tail frontend logs
	docker compose logs -f frontend

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------

backend-install: ## Install backend dependencies
	cd backend && pip install -r requirements.txt

backend-run: ## Run backend dev server locally
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test: ## Run backend tests
	cd backend && pytest -v

test-cov: ## Run backend tests with coverage report
	cd backend && pytest --cov=app --cov-report=term-missing

test-isolation: ## Run tenant isolation tests only
	cd backend && pytest tests/test_tenant_isolation/ -v

lint: ## Lint backend with ruff
	cd backend && ruff check .

lint-fix: ## Lint and auto-fix backend
	cd backend && ruff check . --fix

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

frontend-run: ## Run frontend dev server locally
	cd frontend && npm run dev

frontend-build: ## Build frontend for production
	cd frontend && npm run build

frontend-lint: ## Lint frontend with ESLint
	cd frontend && npm run lint

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

migrate: ## Run database migrations
	cd backend && alembic upgrade head

migrate-down: ## Rollback one migration
	cd backend && alembic downgrade -1

migrate-new: ## Create new migration (usage: make migrate-new msg="description")
	cd backend && alembic revision --autogenerate -m "$(msg)"

migrate-history: ## Show migration history
	cd backend && alembic history

# ---------------------------------------------------------------------------
# Backup / Restore
# ---------------------------------------------------------------------------

backup: ## Backup database
	./scripts/backup.sh

restore: ## Restore database (usage: make restore file=backups/saas_db_xxx.sql.gz)
	./scripts/restore.sh $(file)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

setup: backend-install frontend-install migrate ## Full local setup (install deps + migrate)
	@echo "Setup complete. Run 'make backend-run' and 'make frontend-run' in separate terminals."

clean: ## Remove generated files and caches
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.pytest_cache backend/.ruff_cache
	rm -rf frontend/.next frontend/node_modules/.cache
