#!/usr/bin/env python3
"""
Performance Benchmark Script for Harmony SaaS API

Usage:
    python scripts/benchmark.py [--base-url http://localhost:8000] [--iterations 50]

Requirements:
    pip install httpx

Benchmarks key API endpoints and reports response times.
"""
import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, field

try:
    import httpx
except ImportError:
    print("httpx is required. Install with: pip install httpx")
    exit(1)


API_PREFIX = "/api/v1"


@dataclass
class BenchmarkResult:
    name: str
    times: list[float] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.times)

    @property
    def avg_ms(self) -> float:
        return statistics.mean(self.times) * 1000 if self.times else 0

    @property
    def median_ms(self) -> float:
        return statistics.median(self.times) * 1000 if self.times else 0

    @property
    def p95_ms(self) -> float:
        if not self.times:
            return 0
        sorted_times = sorted(self.times)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[min(idx, len(sorted_times) - 1)] * 1000

    @property
    def min_ms(self) -> float:
        return min(self.times) * 1000 if self.times else 0

    @property
    def max_ms(self) -> float:
        return max(self.times) * 1000 if self.times else 0


async def register_test_tenant(client: httpx.AsyncClient) -> dict:
    """Register a test tenant and return credentials + tokens."""
    ts = int(time.time() * 1000)
    data = {
        "company_name": f"Bench Corp {ts}",
        "subdomain": f"bench{ts}",
        "admin_email": f"bench{ts}@example.com",
        "admin_password": "BenchPass123!",
        "admin_name": "Bench Admin",
    }
    resp = await client.post(f"{API_PREFIX}/auth/register", json=data)
    resp.raise_for_status()
    return resp.json()


async def timed_request(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> float:
    """Make a request and return the elapsed time in seconds."""
    start = time.perf_counter()
    resp = await getattr(client, method)(url, **kwargs)
    elapsed = time.perf_counter() - start
    resp.raise_for_status()
    return elapsed


async def run_benchmarks(base_url: str, iterations: int):
    print(f"Harmony SaaS API Benchmark")
    print(f"Base URL: {base_url}")
    print(f"Iterations per endpoint: {iterations}")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        # Health check (warmup)
        await client.get("/health")

        # Register test tenant
        print("\nSetting up test tenant...")
        reg = await register_test_tenant(client)
        tokens = reg["tokens"]
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        results: list[BenchmarkResult] = []

        # Define benchmarks
        benchmarks = [
            ("GET /health", "get", "/health", {}),
            ("GET /health/detailed", "get", "/health/detailed", {}),
            ("POST /auth/login", "post", f"{API_PREFIX}/auth/login", {
                "json": {
                    "email": reg["user"]["email"],
                    "password": "BenchPass123!",
                }
            }),
            ("GET /auth/me", "get", f"{API_PREFIX}/auth/me", {"headers": headers}),
            ("GET /users", "get", f"{API_PREFIX}/users", {"headers": headers}),
            ("GET /branches", "get", f"{API_PREFIX}/branches", {"headers": headers}),
            ("POST /auth/refresh", "post", f"{API_PREFIX}/auth/refresh", {
                "json": {"refresh_token": tokens["refresh_token"]},
            }),
        ]

        for name, method, url, kwargs in benchmarks:
            result = BenchmarkResult(name=name)
            # Warmup
            try:
                await timed_request(client, method, url, **kwargs)
            except Exception:
                print(f"  SKIP {name} (endpoint unavailable)")
                continue

            for _ in range(iterations):
                try:
                    elapsed = await timed_request(client, method, url, **kwargs)
                    result.times.append(elapsed)
                except Exception:
                    pass  # skip failed requests

            results.append(result)
            print(f"  {name}: avg={result.avg_ms:.1f}ms, p95={result.p95_ms:.1f}ms, n={result.count}")

        # Print summary table
        print("\n" + "=" * 70)
        print(f"{'Endpoint':<30} {'Avg':>8} {'Median':>8} {'P95':>8} {'Min':>8} {'Max':>8}")
        print("-" * 70)
        for r in results:
            print(
                f"{r.name:<30} "
                f"{r.avg_ms:>7.1f}ms "
                f"{r.median_ms:>7.1f}ms "
                f"{r.p95_ms:>7.1f}ms "
                f"{r.min_ms:>7.1f}ms "
                f"{r.max_ms:>7.1f}ms"
            )
        print("=" * 70)

        # Concurrent benchmark
        print("\nConcurrent requests (10 parallel GET /health)...")
        start = time.perf_counter()
        tasks = [timed_request(client, "get", "/health") for _ in range(10)]
        concurrent_times = await asyncio.gather(*tasks, return_exceptions=True)
        total = time.perf_counter() - start
        successes = [t for t in concurrent_times if isinstance(t, float)]
        print(f"  10 requests completed in {total * 1000:.1f}ms ({len(successes)} succeeded)")
        if successes:
            print(f"  Avg per request: {statistics.mean(successes) * 1000:.1f}ms")

        print("\nBenchmark complete.")


def main():
    parser = argparse.ArgumentParser(description="Harmony SaaS API Benchmark")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--iterations", type=int, default=50, help="Iterations per endpoint")
    args = parser.parse_args()

    asyncio.run(run_benchmarks(args.base_url, args.iterations))


if __name__ == "__main__":
    main()
