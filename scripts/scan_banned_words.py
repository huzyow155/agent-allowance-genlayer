import os
import re
import sys

BANNED_PATTERNS = [
    (r'\bcryptographic\s+proof\b', 'cryptographic proof'),
    (r'\btamper-?proof\b', 'tamper-proof'),
    (r'\btampered\b', 'tampered'),
    (r'\bbytecode\b', 'bytecode'),
    (r'\btestnet\b', 'testnet'),
    (r'\bunanimous(ly)?\b', 'unanimous'),
    (r'\brevolutionary\b', 'revolutionary'),
    (r'\bno\s+other\s+contract\b', 'no other contract'),
    (r'\bno\s+contract\s+does\b', 'no contract does'),
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__'}
ALLOWED_FILES = {'scan_banned_words.py'}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in ALLOWED_FILES:
                continue
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.py', '.css')):
                continue
            path = os.path.join(r, f)
            rel_path = os.path.relpath(path, root).replace('\\', '/')
            
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    # Check finalized in docs/markdown (must only be used if referring to literal status_name FINALIZED)
                    if f.endswith('.md') and re.search(r'\bfinalized\b', line, re.IGNORECASE):
                        if 'status_name' not in line and 'FINALIZED' not in line:
                            violations.append((rel_path, line_idx, 'finalized outside status_name', line.strip()))

                    # Check 'live' in docs/markdown (must write Studionet or Preview instead of live testnet/live network)
                    if f.endswith('.md') and re.search(r'\blive\s+(network|mainnet|testnet|system|mode|environment)\b', line, re.IGNORECASE):
                        violations.append((rel_path, line_idx, 'live network/system', line.strip()))

                    if f.endswith('.md') and re.search(r'^\s*#+\s*.*\bLive\b', line):
                        violations.append((rel_path, line_idx, 'Live in heading/title', line.strip()))

                    if f.endswith('.md') and re.search(r'\blive\s+evidence\b', line, re.IGNORECASE):
                        violations.append((rel_path, line_idx, 'live evidence', line.strip()))

                    for pat, name in BANNED_PATTERNS:
                        m = re.search(pat, line, re.IGNORECASE)
                        if m:
                            violations.append((rel_path, line_idx, m.group(0), line.strip()))
    
    # If extra file arguments provided (e.g. report.txt), scan them explicitly
    for extra_file in sys.argv[1:]:
        if os.path.exists(extra_file):
            with open(extra_file, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    if re.search(r'\bfinalized\b', line, re.IGNORECASE) and 'status_name' not in line and 'FINALIZED' not in line:
                        violations.append((extra_file, line_idx, 'finalized outside status_name', line.strip()))
                    if re.search(r'\blive\s+(network|mainnet|testnet|system|mode|environment)\b', line, re.IGNORECASE):
                        violations.append((extra_file, line_idx, 'live network/system', line.strip()))
                    if re.search(r'^\s*#+\s*.*\bLive\b', line):
                        violations.append((extra_file, line_idx, 'Live in heading/title', line.strip()))
                    if re.search(r'\blive\s+evidence\b', line, re.IGNORECASE):
                        violations.append((extra_file, line_idx, 'live evidence', line.strip()))
                    for pat, name in BANNED_PATTERNS:
                        m = re.search(pat, line, re.IGNORECASE)
                        if m:
                            violations.append((extra_file, line_idx, m.group(0), line.strip()))

    if violations:
        print(f"FAILED: Found {len(violations)} banned word violations:")
        for path, line_no, matched, text in violations:
            print(f"  {path}:{line_no} [{matched}] -> {text[:100]}")
        sys.exit(1)
    else:
        print("PASSED: Zero banned words detected across codebase and docs.")
        sys.exit(0)

if __name__ == '__main__':
    scan()
