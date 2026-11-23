#!/usr/bin/env python3
"""Fetch an Android (bionic) OpenJDK from Termux's package repo, verify SHA-256 against the repo index,
resolve its shared-library dependencies, and lay it out as  OUT/jre  +  OUT/lib  for the emulator.
Usage: fetch_termux_jre.py <major:21|25|17> <arch:x86_64|aarch64> <outdir>"""
import hashlib, os, re, shutil, subprocess, sys, tarfile, urllib.request
major, arch, out = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = "https://packages.termux.dev/apt/termux-main/"
SKIP = {"ca-certificates-java", "alsa-plugins", "alsa-lib", "pulseaudio", "libpulseaudio"}  # not needed headless
def get(url, dest=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "luminos-ci"}), timeout=300) as r:
        data = r.read()
    if dest: open(dest, "wb").write(data)
    return data
idx = get(BASE + f"dists/stable/main/binary-{arch}/Packages").decode()
pk = {}
for b in idx.split("\n\n"):
    m = re.search(r"^Package: (.+)$", b, re.M)
    if m: pk[m.group(1)] = {k: (re.search(rf"^{k}: (.*)$", b, re.M) or [None, ""])[1] for k in ("Version", "Depends", "Filename", "SHA256", "Size")}
want, seen, order = f"openjdk-{major}", set(), []
def visit(n):
    if n in seen or n in SKIP or n not in pk: return
    seen.add(n)
    for d in pk[n]["Depends"].split(","):
        d = re.sub(r"\(.*?\)", "", d.split("|")[0]).strip()
        if d: visit(d)
    order.append(n)
visit(want)
print("packages:", order, flush=True)
work = os.path.join(out, "_work"); os.makedirs(work, exist_ok=True)
root = os.path.join(out, "root"); os.makedirs(root, exist_ok=True)
for n in order:
    p = pk[n]; deb = os.path.join(work, n + ".deb")
    data = get(BASE + p["Filename"], deb)
    h = hashlib.sha256(data).hexdigest()
    assert h == p["SHA256"], f"SHA256 mismatch for {n}: {h} != {p['SHA256']}"
    print(f"ok sha256 {n} {p['Version']} {len(data)//1024} KiB", flush=True)
    d = os.path.join(work, n); os.makedirs(d, exist_ok=True)
    subprocess.check_call(["ar", "x", deb], cwd=d)
    tarf = [f for f in os.listdir(d) if f.startswith("data.tar")][0]
    subprocess.check_call(["tar", "-xf", tarf, "-C", root], cwd=d)
    os.remove(deb)
prefix = os.path.join(root, "data/data/com.termux/files/usr")
jre_src = os.path.join(prefix, "lib/jvm", f"java-{major}-openjdk")
assert os.path.isdir(jre_src), "jvm dir missing: " + str(os.listdir(os.path.join(prefix, "lib/jvm")))
jre = os.path.join(out, "jre"); shutil.rmtree(jre, ignore_errors=True)
shutil.copytree(jre_src, jre, symlinks=False, ignore_dangling_symlinks=True)
for junk in ("jmods", "include", "man", "demo", "sample", "src.zip", "legal"):
    shutil.rmtree(os.path.join(jre, junk), ignore_errors=True)
libd = os.path.join(out, "lib"); os.makedirs(libd, exist_ok=True)
for f in os.listdir(os.path.join(prefix, "lib")):
    s = os.path.join(prefix, "lib", f)
    if ".so" in f and os.path.isfile(s): shutil.copy2(os.path.realpath(s), os.path.join(libd, f))
shutil.rmtree(work); shutil.rmtree(root)
tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print(f"layout ready: {out} ({tot//1048576} MiB); bin: {sorted(os.listdir(os.path.join(jre,'bin')))[:8]}; libs: {len(os.listdir(libd))}")
