import asyncio
import logging
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Service:
    def __init__(self):
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.region = settings.AWS_S3_REGION_NAME

    def _get_client(self):
        return boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.region,
        )

    def _upload_file_sync(
        self,
        file_bytes: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
    ) -> Optional[str]:
        """Synchronously upload bytes to AWS S3 bucket and return public URL."""
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            logger.warning("AWS S3 credentials missing. File upload skipped.")
            return None

        try:
            s3_client = self._get_client()
            s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_bytes,
                ContentType=content_type,
            )
            file_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{object_name}"
            logger.info("Successfully uploaded file to S3: %s", file_url)
            return file_url
        except ClientError as e:
            logger.error("Failed to upload file to AWS S3: %s", e)
            return None

    async def upload_file(
        self,
        file_bytes: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
    ) -> Optional[str]:
        """Asynchronously upload file bytes to S3 without blocking the event loop."""
        return await asyncio.to_thread(
            self._upload_file_sync,
            file_bytes=file_bytes,
            object_name=object_name,
            content_type=content_type,
        )


s3_service = S3Service()
