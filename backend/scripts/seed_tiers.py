#!/usr/bin/env python3
"""
Seed script for subscription tiers.
Migrates hardcoded TIER_CONFIGS to database.

Usage:
    python scripts/seed_tiers.py
    python scripts/seed_tiers.py --force  # Overwrite existing tiers
"""
import sys
import os
import argparse

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.subscription_tier import SubscriptionTier
from app.services.subscription_tier_service import DEFAULT_TIERS


def seed_tiers(force: bool = False):
    """Seed subscription tiers into database."""
    db = SessionLocal()

    try:
        print("Seeding subscription tiers...")

        for tier_data in DEFAULT_TIERS:
            # Check if tier already exists
            existing = db.query(SubscriptionTier).filter(
                SubscriptionTier.code == tier_data["code"]
            ).first()

            if existing:
                if force:
                    print(f"  Updating existing tier: {tier_data['code']}")
                    for key, value in tier_data.items():
                        setattr(existing, key, value)
                else:
                    print(f"  Tier '{tier_data['code']}' already exists, skipping (use --force to update)")
                    continue
            else:
                print(f"  Creating tier: {tier_data['code']}")
                tier = SubscriptionTier(**tier_data)
                db.add(tier)

        db.commit()
        print("\nSubscription tiers seeded successfully!")

        # Print summary
        tiers = db.query(SubscriptionTier).filter(
            SubscriptionTier.is_active == True
        ).order_by(SubscriptionTier.sort_order).all()

        print("\nCurrent tiers:")
        print("-" * 80)
        for tier in tiers:
            unlimited_users = "Unlimited" if tier.max_users == -1 else str(tier.max_users)
            unlimited_branches = "Unlimited" if tier.max_branches == -1 else str(tier.max_branches)
            print(
                f"  {tier.code:12} | {tier.display_name:12} | "
                f"IDR {tier.price_monthly:>10,}/mo | "
                f"{unlimited_users:>8} users | {unlimited_branches:>8} branches | "
                f"{tier.max_storage_gb:>3} GB"
            )
        print("-" * 80)

    except Exception as e:
        db.rollback()
        print(f"Error seeding tiers: {e}")
        raise
    finally:
        db.close()


def seed_payment_methods():
    """Seed default payment methods."""
    db = SessionLocal()

    try:
        from app.models.payment_method import PaymentMethod, PaymentMethodType

        default_methods = [
            {
                "code": "bca",
                "name": "Bank BCA",
                "type": PaymentMethodType.BANK_TRANSFER,
                "bank_name": "Bank Central Asia (BCA)",
                "account_number": "1234567890",
                "account_name": "PT Harmony Indonesia",
                "instructions": "Transfer ke rekening BCA di atas. Pastikan nominal sesuai dengan total tagihan.",
                "sort_order": 0,
                "is_public": True,
            },
            {
                "code": "mandiri",
                "name": "Bank Mandiri",
                "type": PaymentMethodType.BANK_TRANSFER,
                "bank_name": "Bank Mandiri",
                "account_number": "0987654321",
                "account_name": "PT Harmony Indonesia",
                "instructions": "Transfer ke rekening Mandiri di atas. Pastikan nominal sesuai dengan total tagihan.",
                "sort_order": 1,
                "is_public": True,
            },
            {
                "code": "bni",
                "name": "Bank BNI",
                "type": PaymentMethodType.BANK_TRANSFER,
                "bank_name": "Bank Negara Indonesia (BNI)",
                "account_number": "1122334455",
                "account_name": "PT Harmony Indonesia",
                "instructions": "Transfer ke rekening BNI di atas. Pastikan nominal sesuai dengan total tagihan.",
                "sort_order": 2,
                "is_public": True,
            },
            {
                "code": "qris",
                "name": "QRIS",
                "type": PaymentMethodType.QRIS,
                "bank_name": None,
                "account_number": None,
                "account_name": None,
                "instructions": "Scan QRIS code menggunakan aplikasi e-wallet atau mobile banking Anda. Pastikan nominal sesuai dengan total tagihan.",
                "sort_order": 3,
                "is_public": True,
            },
        ]

        print("\nSeeding payment methods...")

        for method_data in default_methods:
            existing = db.query(PaymentMethod).filter(
                PaymentMethod.code == method_data["code"]
            ).first()

            if existing:
                print(f"  Payment method '{method_data['code']}' already exists, skipping")
                continue

            print(f"  Creating payment method: {method_data['code']}")
            method = PaymentMethod(**method_data)
            db.add(method)

        db.commit()
        print("Payment methods seeded successfully!")

        # Print summary
        methods = db.query(PaymentMethod).filter(
            PaymentMethod.is_active == True
        ).order_by(PaymentMethod.sort_order).all()

        print("\nCurrent payment methods:")
        print("-" * 60)
        for method in methods:
            print(f"  {method.code:12} | {method.name:20} | {method.type}")
        print("-" * 60)

    except Exception as e:
        db.rollback()
        print(f"Error seeding payment methods: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed subscription tiers and payment methods")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing tiers with default values"
    )
    parser.add_argument(
        "--tiers-only",
        action="store_true",
        help="Only seed tiers, skip payment methods"
    )
    parser.add_argument(
        "--payments-only",
        action="store_true",
        help="Only seed payment methods, skip tiers"
    )
    args = parser.parse_args()

    if not args.payments_only:
        seed_tiers(force=args.force)

    if not args.tiers_only:
        seed_payment_methods()

    print("\nDone!")
