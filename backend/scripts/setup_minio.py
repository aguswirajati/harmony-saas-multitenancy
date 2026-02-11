#!/usr/bin/env python3
"""
Script to configure MinIO bucket with public access policy and CORS.
Run this after starting MinIO to enable public file access.

Usage:
    cd backend
    python scripts/setup_minio.py
"""

import asyncio
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import aioboto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

# Configuration - matches config.py defaults
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "minioadmin")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "minioadmin123")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "harmony-uploads")
S3_REGION = os.getenv("S3_REGION", "us-east-1")


def get_public_bucket_policy(bucket_name: str) -> str:
    """Get bucket policy that allows public read for public paths."""
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadForPublicFiles",
                "Effect": "Allow",
                "Principal": "*",
                "Action": ["s3:GetObject"],
                "Resource": [
                    f"arn:aws:s3:::{bucket_name}/tenant-logos/*",
                    f"arn:aws:s3:::{bucket_name}/avatars/*"
                ]
            }
        ]
    }
    return json.dumps(policy)


async def setup_minio():
    """Configure MinIO bucket with public policy and CORS."""
    print(f"Connecting to MinIO at {S3_ENDPOINT_URL}...")

    session = aioboto3.Session()
    config = BotoConfig(
        signature_version='s3v4',
        retries={'max_attempts': 3, 'mode': 'standard'}
    )

    async with session.client(
        's3',
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        region_name=S3_REGION,
        config=config
    ) as s3:
        # Check/create bucket
        try:
            await s3.head_bucket(Bucket=S3_BUCKET_NAME)
            print(f"Bucket '{S3_BUCKET_NAME}' exists")
        except ClientError:
            print(f"Creating bucket '{S3_BUCKET_NAME}'...")
            await s3.create_bucket(Bucket=S3_BUCKET_NAME)
            print(f"Bucket created")

        # Set public read policy
        print("Setting public read policy for tenant-logos and avatars...")
        try:
            policy = get_public_bucket_policy(S3_BUCKET_NAME)
            await s3.put_bucket_policy(Bucket=S3_BUCKET_NAME, Policy=policy)
            print("Bucket policy set successfully")
        except ClientError as e:
            print(f"Warning: Could not set bucket policy: {e}")

        # Set CORS configuration
        print("Setting CORS configuration...")
        try:
            cors_config = {
                'CORSRules': [
                    {
                        'AllowedHeaders': ['*'],
                        'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                        'AllowedOrigins': ['*'],
                        'ExposeHeaders': ['ETag'],
                        'MaxAgeSeconds': 3600
                    }
                ]
            }
            await s3.put_bucket_cors(Bucket=S3_BUCKET_NAME, CORSConfiguration=cors_config)
            print("CORS configuration set successfully")
        except ClientError as e:
            print(f"Warning: Could not set CORS configuration: {e}")

        print("\nMinIO setup complete!")
        print(f"  - Bucket: {S3_BUCKET_NAME}")
        print(f"  - Public paths: /tenant-logos/*, /avatars/*")
        print(f"  - Access URL: {S3_ENDPOINT_URL}/{S3_BUCKET_NAME}/")


if __name__ == "__main__":
    asyncio.run(setup_minio())
