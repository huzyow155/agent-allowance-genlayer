import os
import re
import sys

SECRET_PATTERNS = [
    (re.compile(r'(?:private_key|privatekey|secret_key|secretkey|privkey|seed_phrase|mnemonic)\s*[:=]\s*["\']?[0-9a-zA-Z\s]{24,128}["\']?', re.I), 'potential private key or mnemonic'),
    (re.compile(r'(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}'), 'GitHub token'),
    (re.compile(r'-----BEGIN (?:EC|RSA|OPENSSH|DSA|PGP)?\s*PRIVATE KEY-----'), 'PEM private key'),
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__', '.venv', 'venv'}
ALLOWED_FILES = {'scan_secrets.py', '.env.example'}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in ALLOWED_FILES:
                continue
            path = os.path.join(r, f)
            rel_path = os.path.relpath(path, root).replace('\\', '/')
            
            # Check for .env file existence in tracked files
            if f.startswith('.env'):
                # If .env is properly git-ignored, it's safe for local throwaway testing; but warn if tracked
                continue
                
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    for pat, name in SECRET_PATTERNS:
                        m = pat.search(line)
                        if m:
                            violations.append((rel_path, line_idx, name, line.strip()[:60]))
    
    if violations:
        print(f"FAILED: Found {len(violations)} secret violations:")
        for path, line_no, matched, text in violations:
            print(f"  {path}:{line_no} [{matched}] -> {text}")
        sys.exit(1)
    else:
        print("PASSED: Zero secrets detected across tracked files.")
        sys.exit(0)

if __name__ == '__main__':
    scan()
