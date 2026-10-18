import os
import sys

def scan_ascii():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    contracts_dir = os.path.join(root, 'contracts')
    if not os.path.exists(contracts_dir):
        print("No contracts directory yet; scan passed.")
        return 0

    has_error = False
    for fname in os.listdir(contracts_dir):
        if not fname.endswith('.py'):
            continue
        fpath = os.path.join(contracts_dir, fname)
        with open(fpath, 'rb') as fp:
            data = fp.read()
        try:
            data.decode('ascii')
            print(f"PASSED ASCII check: {fname}")
        except UnicodeDecodeError as e:
            print(f"FAILED ASCII check: {fname} contains non-ASCII characters at byte {e.start}: {e.reason}")
            has_error = True

    return 1 if has_error else 0

if __name__ == '__main__':
    sys.exit(scan_ascii())
