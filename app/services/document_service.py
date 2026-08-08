import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from app.core.exceptions import BadRequestException
from app.services.s3_service import s3_service

logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path("uploads/documents")


class DocumentService:
    def __init__(self):
        try:
            DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        except OSError as err:
            logger.warning("Could not create uploads/documents directory: %s", err)

    async def save_document(
        self, file: UploadFile, doc_type: str = "document"
    ) -> str:
        """
        Validates file upload, uploads to AWS S3 if credentials exist,
        otherwise saves to local `uploads/documents/` directory and returns static URL.
        """
        if not file or not file.filename:
            raise BadRequestException(f"No file uploaded for {doc_type}.")

        content = await file.read()
        if len(content) == 0:
            raise BadRequestException(f"Uploaded file for {doc_type} is empty.")

        ext = Path(file.filename).suffix.lower()
        if not ext:
            ext = ".jpg"

        filename = f"{doc_type}_{uuid.uuid4().hex[:10]}{ext}"
        object_name = f"partner_documents/{filename}"

        # 1. Try uploading to S3 if configured
        s3_url = await s3_service.upload_file(
            file_bytes=content,
            object_name=object_name,
            content_type=file.content_type or "application/octet-stream",
        )
        if s3_url:
            return s3_url

        # 2. Fallback to local file storage
        file_path = DOCUMENTS_DIR / filename
        try:
            with open(file_path, "wb") as f:
                f.write(content)
            logger.info("Saved partner document locally: %s", file_path)
            return f"/static/documents/{filename}"
        except Exception as e:
            logger.error("Failed to save document locally: %s", e)
            raise BadRequestException(f"Failed to store uploaded file for {doc_type}.")


document_service = DocumentService()
