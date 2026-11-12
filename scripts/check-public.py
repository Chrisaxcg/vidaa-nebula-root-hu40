#!/usr/bin/env python3
"""Offline publication checks; no TV access or network calls."""
from pathlib import Path
import ast, re, subprocess, sys
root = Path(__file__).resolve().parents[1]
errors = []
for p in root.rglob('*'):
    if any(x in {'.git', 'node_modules', '__pycache__'} for x in p.parts) or not p.is_file():
        continue
    if p.suffix == '.py':
        ast.parse(p.read_text(), filename=str(p))
    if p.suffix == '.md':
        for target in re.findall(r'\]\(([^\s)]+)\)', p.read_text()):
            if '://' in target or target.startswith('#') or target.startswith('mailto:'):
                continue
            target = target.split('#')[0]
            if not (p.parent / target).exists():
                errors.append(f'Broken link: {p.relative_to(root)} -> {target}')
    if p.suffix in {'.js', '.cjs'}:
        subprocess.run(['node', '--check', str(p)], check=True, capture_output=True)
    if p.suffix == '.sh':
        subprocess.run(['bash', '-n', str(p)], check=True)
if errors:
    raise SystemExit('\n'.join(errors))
subprocess.run([sys.executable, str(root / 'tools/sanitize/scan.py'), '--root', str(root)], check=True)
print('Public source checks passed: links, syntax and configured secret/PII patterns.')
