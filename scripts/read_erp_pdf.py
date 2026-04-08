import sys
from pathlib import Path
from pdfminer.high_level import extract_text


def main():
    pdf_dir = Path.home() / "Downloads"
    candidates = sorted(p for p in pdf_dir.iterdir() if "CLG ERP.pdf" in p.name)
    if not candidates:
        raise SystemExit("PDF not found")
    pdf_path = candidates[0]
    text = extract_text(str(pdf_path), maxpages=3)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(text[:4000])


if __name__ == "__main__":
    main()
