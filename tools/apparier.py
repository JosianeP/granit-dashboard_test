#!/usr/bin/env python3
"""
Propose un appariement entre les fiches locales de data.json (répertoire économique et membres
touristiques, clé id) et le Registre des entreprises (data/req/granit_latest.json, clé neq).

Écrit data/appariement.json, lu par granit-req.js. Seuls les liens de statut « auto » (nom identique)
ou « valide » (confirmé à la main) sont appliqués dans le tableau de bord. Les statuts « valide » et
« rejete » posés à la main sont conservés quand le fichier est régénéré.

Usage : python tools/apparier.py data.json data/req/granit_latest.json data/appariement.json
"""
import json, re, sys, unicodedata, difflib, datetime, collections
DATA, REQ, OUT = sys.argv[1:4]
STOP = set("inc ltee ltd limitee enr senc cie corp corporation canada quebec the la le les l de du des d et a au aux en sur".split())
def norm(s):
    s = (s or "").replace("\u2019", "'").replace("&", " et ")
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\bvoir ligne \d+\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\bste\b", "sainte", s); s = re.sub(r"\bst\b", "saint", s)
    s = re.sub(r"\b((?:[a-z] )+[a-z])\b", lambda m: m.group(1).replace(" ", ""), s)  # m d p -> mdp
    return " ".join(w for w in s.split() if w not in STOP)
D = json.load(open(DATA, encoding="utf-8")); G = json.load(open(REQ, encoding="utf-8"))
reg = []
for e in G["entreprises"]:
    for n in [e.get("nom", "")] + e.get("autres_noms", []):
        k = norm(n)
        if k: reg.append((k, set(k.split()), e, n))
by_key = collections.defaultdict(list)
for k, _, e, n in reg: by_key[k].append((e, n))
# les décisions prises à la main (valide, rejete) survivent à une régénération
import os
manuel = {}
if os.path.exists(OUT):
    for l in json.load(open(OUT, encoding="utf-8")).get("liens", []):
        if l.get("statut") in ("valide", "rejete"): manuel[l["id"]] = l
liens = []
for c in D["companies"]:
    if c["id"] in manuel:
        liens.append(manuel[c["id"]]); continue
    k = norm(c["name"]); toks = set(k.split())
    rec = {"id": c["id"], "nom_local": c["name"], "muni": c["muni"], "src": c["src"], "neq": "", "nom_registre": "", "muni_registre": "", "methode": "", "statut": "aucun"}
    cands = {}
    def add(e, n, score, meth):
        cur = cands.get(e["neq"])
        if not cur or score > cur[0]: cands[e["neq"]] = (score, meth, e, n)
    for e, n in by_key.get(k, []): add(e, n, 1.0, "nom identique")
    if len(k) >= 5:
        for rk, rt, e, n in reg:
            if rk == k: continue
            if len(toks) >= 2 and toks <= rt: add(e, n, 0.9, "nom local contenu dans le nom du registre")
            elif len(rt) >= 2 and rt <= toks: add(e, n, 0.85, "nom du registre contenu dans le nom local")
            else:
                r = difflib.SequenceMatcher(None, k, rk).ratio()
                if r >= 0.86: add(e, n, round(r * 0.9, 2), "noms voisins")
    # bonus si la municipalité concorde
    lst = sorted(((s + (0.05 if e["muni"] == c["muni"] else 0), m, e, n) for s, m, e, n in cands.values()), key=lambda x: -x[0])
    if lst:
        s, m, e, n = lst[0]
        exacts = [x for x in lst if x[1] == "nom identique"]
        same = [x for x in exacts if x[2]["muni"] == c["muni"]]
        rec.update(neq=e["neq"], nom_registre=n, muni_registre=e["muni"], methode=m)
        if m == "nom identique" and (len(exacts) == 1 or len(same) == 1):
            if len(same) == 1: s, m, e, n = same[0]; rec.update(neq=e["neq"], nom_registre=n, muni_registre=e["muni"])
            rec["statut"] = "auto"
        else:
            rec["statut"] = "a_valider"
            rec["autres_candidats"] = [{"neq": x[2]["neq"], "nom": x[3], "muni": x[2]["muni"]} for x in lst[1:4]]
    liens.append(rec)
cnt = collections.Counter((l["src"], l["statut"]) for l in liens)
out = {"_note": "Appariement entre les fiches locales de data.json (clé id) et le Registre des entreprises (clé neq). "
                "statut : auto = nom identique, appliqué; a_valider = proposition non appliquée; valide = confirmé à la main, appliqué; "
                "rejete = écarté à la main; aucun = pas de candidat. Seuls auto et valide sont utilisés par le tableau de bord. "
                "Les statuts valide et rejete sont conservés quand ce fichier est régénéré.",
       "genere": datetime.date.today().isoformat(), "extraction_registre": G.get("extraction", ""), "liens": liens}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, v in sorted(cnt.items()): print(k, v)
