import logging
import math
import os
import re
from typing import List, Tuple
import pypdf

logger = logging.getLogger(__name__)


class PageCounterEngine:
    """
    Automated Document Page Counter Engine for Print/Xerox services.
    Supports PDF parsing via pypdf with fallback regex stream counting, 
    Image single page detection, and Text/Docx length estimation.
    """

    def count_pages(self, file_path: str, filename: str) -> Tuple[int, str]:
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            try:
                reader = pypdf.PdfReader(file_path)
                num_pages = len(reader.pages)
                if num_pages > 0:
                    return num_pages, "pdf"
            except Exception as e:
                logger.warning(f"pypdf reader failed for {file_path}: {e}. Trying fallback regex count.")

            # Fallback for PDFs: count /Type /Page occurrences or /Count
            try:
                with open(file_path, "rb") as f:
                    content = f.read()

                # Search for /Count N
                match = re.search(br"/Count\s+(\d+)", content)
                if match:
                    return int(match.group(1)), "pdf_regex"

                # Count /Type /Page or /Type/Page
                page_matches = len(re.findall(br"/Type\s*/Page\b", content))
                if page_matches > 0:
                    return page_matches, "pdf_regex"
            except Exception as err:
                logger.error(f"Fallback PDF regex count failed: {err}")

            return 1, "pdf_default"

        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
            return 1, "image"

        elif ext == ".txt":
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                # ~3000 characters per standard printed page
                pages = max(1, math.ceil(len(text) / 3000.0))
                return pages, "text"
            except Exception:
                return 1, "text"

        else:
            # General file format size fallback (~20KB per page)
            try:
                size_bytes = os.path.getsize(file_path)
                pages = max(1, math.ceil(size_bytes / 20000.0))
                return pages, "document_estimate"
            except Exception:
                return 1, "document_estimate"

    def parse_page_range(self, range_str: str, total_pages: int) -> int:
        """
        Parse custom page range string like '1-5, 8-12, 15' or 'all'
        and return the count of selected unique valid pages.
        """
        if not range_str or range_str.strip().lower() == "all":
            return total_pages

        selected_pages = set()
        parts = range_str.split(",")

        for part in parts:
            part = part.strip()
            if not part:
                continue

            if "-" in part:
                sub_parts = part.split("-")
                if len(sub_parts) == 2 and sub_parts[0].isdigit() and sub_parts[1].isdigit():
                    start = int(sub_parts[0])
                    end = int(sub_parts[1])
                    if start <= end:
                        for p in range(start, end + 1):
                            if 1 <= p <= total_pages:
                                selected_pages.add(p)
            elif part.isdigit():
                p = int(part)
                if 1 <= p <= total_pages:
                    selected_pages.add(p)

        return len(selected_pages) if selected_pages else total_pages

    def calculate_print_cost(
        self,
        num_pages: int,
        num_copies: int = 1,
        color_mode: str = "black_and_white",
        paper_size: str = "A4",
        is_double_sided: bool = False,
        binding_type: str = "none",
    ) -> dict:
        """
        Calculate print service pricing breakdown.
        - B&W rate: 2.0 INR / page
        - Color rate: 10.0 INR / page
        - Double-sided discount: 15% off page printing cost
        - Binding: Spiral = 30.0 INR / copy, Channel File = 20.0 INR / copy
        """
        page_rate = 10.0 if color_mode.lower() == "color" else 2.0
        if paper_size.upper() == "A3":
            page_rate *= 1.5

        raw_print_cost = page_rate * num_pages * num_copies

        # Double sided discount
        if is_double_sided:
            print_cost = raw_print_cost * 0.85
        else:
            print_cost = raw_print_cost

        binding_cost = 0.0
        b_type = binding_type.lower()
        if b_type == "spiral":
            binding_cost = 30.0 * num_copies
        elif b_type == "channel_file":
            binding_cost = 20.0 * num_copies

        items_total = round(print_cost + binding_cost, 2)
        delivery_fee = 20.0
        total_amount = round(items_total + delivery_fee, 2)

        return {
            "num_pages": num_pages,
            "num_copies": num_copies,
            "color_mode": color_mode,
            "paper_size": paper_size,
            "is_double_sided": is_double_sided,
            "binding_type": binding_type,
            "page_rate": page_rate,
            "print_cost": round(print_cost, 2),
            "binding_cost": round(binding_cost, 2),
            "items_total": items_total,
            "delivery_fee": delivery_fee,
            "total_amount": total_amount,
            "min_order_price_met": items_total >= 10.0,
        }


page_counter_engine = PageCounterEngine()
