#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction du Registre des entreprises du Québec (données ouvertes) pour la MRC du Granit.

Source  : Registraire des entreprises, jeu de données « Registre des entreprises », Données Québec.
Licence : CC BY-NC-SA 4.0 (attribution, pas d'utilisation commerciale, partage dans les mêmes conditions).

Ce script ne modifie PAS data.json. Il écrit dans data/req/ :
  - granit_latest.json   entreprises actives rattachées aux 19 municipalités
  - resume.json          décomptes par municipalité, secteur, forme juridique, année d'immatriculation
  - snapshots/AAAA-MM-JJ.csv   instantané compact (toutes les entreprises, actives ou non)
  - mouvements.json      apparitions, radiations et réactivations depuis l'instantané précédent
  - diagnostic.txt       en-têtes lus, colonnes retenues, rejets, pour valider la qualité

Usage : python tools/req_granit.py [--zip chemin.zip] [--out data/req]
"""
import argparse, csv, datetime, io, json, os, re, sys, unicodedata, urllib.request, zipfile
from collections import Counter, defaultdict

URL = ("https://www.registreentreprises.gouv.qc.ca/RQAnonymeGR/GR/GR03/"
       "GR03A2_22A_PIU_RecupDonnPub_PC/FichierDonneesOuvertes.aspx")
UA = "Mozilla/5.0 (compatible; tableau-de-bord-MRC-du-Granit; +https://github.com/JosianeP/granit-dashboard_test)"

MUNIS = ["Lac-Mégantic", "Frontenac", "Lambton", "Nantes", "Notre-Dame-des-Bois", "Stratford",
         "Lac-Drolet", "Saint-Ludger", "Marston", "Sainte-Cécile-de-Whitton", "Saint-Romain",
         "Audet", "Saint-Sébastien", "Saint-Augustin-de-Woburn", "Stornoway",
         "Saint-Robert-Bellarmin", "Piopolis", "Milan", "Val-Racine"]
# Régions de tri d'acheminement attendues pour le Granit. Sert à écarter les homonymes
# (Stratford en Ontario, Saint-Sébastien en Montérégie, etc.). À ajuster au besoin après
# lecture de diagnostic.txt (section « rejets par code postal »).
RTA_OK = {"G6B", "G0Y", "G0M"}
RTA_PAR_MUNI = {"Notre-Dame-des-Bois": {"J0B"}}
ALIAS = {"woburn": "Saint-Augustin-de-Woburn", "megantic": "Lac-Mégantic",
         "sainte cecile": "Sainte-Cécile-de-Whitton", "saint robert": "Saint-Robert-Bellarmin",
         "saint sebastien de frontenac": "Saint-Sébastien", "saint romain de winslow": "Saint-Romain"}

csv.field_size_limit(10**9)
CP_RE = re.compile(r"\b([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b")


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    s = CP_RE.sub(" ", s)
    s = re.sub(r"\(?\b(quebec|qc|canada)\b\)?", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"\bste\b", "sainte", s)
    s = re.sub(r"\bst\b", "saint", s)
    return s


MUNI_KEY = {norm(m): m for m in MUNIS}
MUNI_KEY.update(ALIAS)


def telecharger(dest):
    print("Téléchargement :", URL)
    req = urllib.request.Request(URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r:
        ctype = r.headers.get("Content-Type", "")
        data_debut = r.read(4)
        if data_debut[:2] == b"PK":
            with open(dest, "wb") as f:
                f.write(data_debut)
                while True:
                    bloc = r.read(1 << 20)
                    if not bloc:
                        break
                    f.write(bloc)
            return
        page = (data_debut + r.read()).decode("utf-8", "ignore")
    # La page a renvoyé du HTML : chercher un lien .zip et le suivre.
    m = re.search(r'href=["\']([^"\']+\.zip[^"\']*)["\']', page, re.I)
    if not m:
        sys.exit("Échec : la source n'a pas renvoyé un ZIP (Content-Type %s) et aucun lien .zip trouvé.\n"
                 "Début de la réponse :\n%s" % (ctype, page[:800]))
    lien = urllib.request.urljoin(URL, m.group(1))
    print("Lien ZIP trouvé :", lien)
    req = urllib.request.Request(lien, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while True:
            bloc = r.read(1 << 20)
            if not bloc:
                break
            f.write(bloc)


def trouver(zf, motif):
    for n in zf.namelist():
        if re.search(motif, os.path.basename(n), re.I) and n.lower().endswith(".csv"):
            return n
    return None


def lire(zf, nom):
    f = io.TextIOWrapper(zf.open(nom), encoding="utf-8-sig", errors="replace", newline="")
    r = csv.reader(f)
    entetes = [h.strip() for h in next(r)]
    return entetes, r


def col(entetes, *motifs, requis=False, quoi=""):
    for mo in motifs:
        for i, h in enumerate(entetes):
            if re.fullmatch(mo, h, re.I):
                return i
    if requis:
        sys.exit("Colonne introuvable (%s). En-têtes lus : %s" % (quoi, entetes))
    return None


def localiser(ligne, idx_adr, rejets):
    """Retourne (municipalité, code postal) si une ligne d'adresse EST le nom d'une municipalité."""
    cp = None
    for i in idx_adr:
        if i < len(ligne):
            m = CP_RE.search(ligne[i])
            if m:
                cp = (m.group(1) + m.group(2)).upper()
    for i in idx_adr:
        if i < len(ligne) and ligne[i]:
            muni = MUNI_KEY.get(norm(ligne[i]))
            if muni:
                if cp and cp[:3] not in (RTA_OK | RTA_PAR_MUNI.get(muni, set())):
                    rejets[(muni, cp[:3])] += 1
                    return None, None
                return muni, cp
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip")
    ap.add_argument("--out", default="data/req")
    a = ap.parse_args()
    chemin = a.zip or "/tmp/req.zip"
    if not a.zip:
        telecharger(chemin)
    zf = zipfile.ZipFile(chemin)
    diag = ["Fichiers du ZIP : %s" % zf.namelist()]
    f_ent, f_eta, f_nom, f_dom = (trouver(zf, r"^entreprise"), trouver(zf, r"^etablissement"),
                                  trouver(zf, r"^nom"), trouver(zf, r"domaine"))
    if not f_ent:
        sys.exit("Entreprise.csv introuvable dans le ZIP : %s" % zf.namelist())

    # Domaines de valeur (libellés des codes)
    dom = defaultdict(dict)
    if f_dom:
        h, r = lire(zf, f_dom)
        diag.append("%s : %s" % (f_dom, h))
        it, ic, iv = col(h, "TYP_DOM_VAL"), col(h, "COD_DOM_VAL"), col(h, "VAL_DOM_FRAN")
        if None not in (it, ic, iv):
            for l in r:
                if len(l) > max(it, ic, iv):
                    dom[l[it].strip()][l[ic].strip()] = l[iv].strip()
    diag.append("Types de domaines de valeur : %s" % sorted(dom))

    def lib(code, *types):
        for t in types:
            for k in dom:
                if k.upper() == t.upper() and code in dom[k]:
                    return dom[k][code]
        return ""

    ent = {}
    rejets = Counter()

    # Passe 1 : domicile de l'entreprise
    h, r = lire(zf, f_ent)
    diag.append("%s : %s" % (f_ent, h))
    iN = col(h, "NEQ", requis=True, quoi="NEQ dans Entreprise")
    adr = [i for i, x in enumerate(h) if re.search(r"ADR_DOMCL", x, re.I)]
    c = dict(statut=col(h, "COD_STAT_IMMAT"), forme=col(h, "COD_FORME_JURI"),
             immat=col(h, "DAT_IMMAT"), dstat=col(h, "DAT_STAT_IMMAT"),
             emp=col(h, "COD_INTVAL_EMPLO_QUE"), cae=col(h, "COD_ACT_ECON_CAE"),
             cae_desc=col(h, "DESC_ACT_ECON_ASSUJ"), faillite=col(h, "IND_FAIL"))
    diag.append("Colonnes d'adresse (domicile) : %s" % [h[i] for i in adr])
    diag.append("Colonnes retenues : %s" % {k: (h[v] if v is not None else None) for k, v in c.items()})
    g = lambda l, k: (l[c[k]].strip() if c[k] is not None and c[k] < len(l) else "")
    base = {}
    total = 0
    for l in r:
        total += 1
        if len(l) <= iN:
            continue
        neq = l[iN].strip()
        rec = dict(neq=neq, statut=g(l, "statut"), forme=g(l, "forme"), immat=g(l, "immat")[:10],
                   date_statut=g(l, "dstat")[:10], emp=g(l, "emp"), cae=g(l, "cae"),
                   cae_desc=g(l, "cae_desc"), faillite=g(l, "faillite"))
        muni, cp = localiser(l, adr, rejets)
        if muni:
            ent[neq] = dict(rec, muni=muni, cp=cp or "", rattachement="domicile")
        else:
            base[neq] = rec  # gardé pour les établissements situés dans le Granit
    diag.append("Entreprises lues : %d ; rattachées par domicile : %d" % (total, len(ent)))

    # Passe 2 : établissements situés dans le Granit (siège ailleurs)
    if f_eta:
        h, r = lire(zf, f_eta)
        diag.append("%s : %s" % (f_eta, h))
        iN2 = col(h, "NEQ", requis=True, quoi="NEQ dans Etablissements")
        adr2 = [i for i, x in enumerate(h) if re.search(r"LIGN\d_ADR|ADR", x, re.I)]
        diag.append("Colonnes d'adresse (établissements) : %s" % [h[i] for i in adr2])
        n_eta = 0
        for l in r:
            if len(l) <= iN2:
                continue
            neq = l[iN2].strip()
            muni, cp = localiser(l, adr2, rejets)
            if not muni:
                continue
            if neq in ent:
                ent[neq].setdefault("etablissements", Counter())[muni] += 1
            elif neq in base:
                ent[neq] = dict(base[neq], muni=muni, cp=cp or "", rattachement="etablissement",
                                etablissements=Counter({muni: 1}))
                n_eta += 1
        diag.append("Ajoutées par établissement (siège hors Granit) : %d" % n_eta)
    del base

    # Passe 3 : noms
    if f_nom:
        h, r = lire(zf, f_nom)
        diag.append("%s : %s" % (f_nom, h))
        iN3 = col(h, "NEQ", requis=True, quoi="NEQ dans Nom")
        iNom = col(h, "NOM_ASSUJ", requis=True, quoi="NOM_ASSUJ")
        iSt, iTy, iFin = col(h, "STAT_NOM"), col(h, "TYP_NOM_ASSUJ"), col(h, "DAT_FIN_NOM_ASSUJ")
        rang = {}
        for l in r:
            if len(l) <= max(iN3, iNom):
                continue
            neq = l[iN3].strip()
            if neq not in ent or not l[iNom].strip():
                continue
            st = l[iSt].strip().upper() if iSt is not None and iSt < len(l) else ""
            ty = l[iTy].strip().upper() if iTy is not None and iTy < len(l) else ""
            fin = l[iFin].strip() if iFin is not None and iFin < len(l) else ""
            score = (2 if st == "V" else 0) + (1 if ty == "N" else 0) + (0 if fin else 1)
            if score > rang.get(neq, -1):
                rang[neq] = score
                ent[neq]["nom"] = l[iNom].strip()
            elif st == "V" and ty != "N":
                ent[neq].setdefault("autres_noms", [])
                if len(ent[neq]["autres_noms"]) < 5:
                    ent[neq]["autres_noms"].append(l[iNom].strip())

    # Libellés et statut actif
    for e in ent.values():
        e["statut_lib"] = lib(e["statut"], "STAT_IMMAT", "COD_STAT_IMMAT")
        e["forme_lib"] = lib(e["forme"], "FORME_JURI", "COD_FORME_JURI")
        e["emp_lib"] = lib(e["emp"], "INTVAL_EMPLO", "COD_INTVAL_EMPLO_QUE", "INTVAL_EMPLO_QUE")
        e["actif"] = e["statut"].upper() == "IM"
        if "etablissements" in e:
            e["etablissements"] = dict(e["etablissements"])
    diag.append("Codes de statut rencontrés : %s" % Counter(e["statut"] for e in ent.values()).most_common())
    diag.append("Rejets par code postal (municipalité homonyme, RTA) : %s" % rejets.most_common(40))

    # Écritures
    out = a.out
    os.makedirs(os.path.join(out, "snapshots"), exist_ok=True)
    jour = datetime.date.today().isoformat()
    attribution = ("Registraire des entreprises du Québec, Registre des entreprises (données ouvertes), "
                   "Données Québec, extraction du %s. Licence CC BY-NC-SA 4.0. Renseignements déclarés "
                   "par les entreprises; adresses des personnes physiques absentes du jeu de données." % jour)
    actifs = sorted((e for e in ent.values() if e["actif"]), key=lambda e: (e["muni"], e.get("nom", "")))
    champs = ["neq", "nom", "muni", "cp", "rattachement", "forme", "forme_lib", "cae", "cae_desc",
              "emp", "emp_lib", "immat", "etablissements", "autres_noms"]
    json.dump({"_source": attribution, "extraction": jour, "n": len(actifs),
               "entreprises": [{k: e[k] for k in champs if e.get(k)} for e in actifs]},
              open(os.path.join(out, "granit_latest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    resume = {"_source": attribution, "extraction": jour,
              "total_actives": len(actifs), "total_toutes": len(ent),
              "par_municipalite": {m: sum(1 for e in actifs if e["muni"] == m) for m in MUNIS},
              "par_rattachement": dict(Counter(e["rattachement"] for e in actifs)),
              "par_forme_juridique": dict(Counter(e["forme_lib"] or e["forme"] for e in actifs).most_common()),
              "par_tranche_employes": dict(Counter(e["emp_lib"] or e["emp"] or "non déclaré" for e in actifs).most_common()),
              "par_activite_cae": dict(Counter((e["cae_desc"] or e["cae"] or "non déclaré") for e in actifs).most_common(60)),
              "immatriculations_par_annee": dict(sorted(Counter(e["immat"][:4] for e in actifs if e["immat"][:4] >= "2000").items()))}
    json.dump(resume, open(os.path.join(out, "resume.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Instantané et mouvements
    snaps = sorted(x for x in os.listdir(os.path.join(out, "snapshots")) if x.endswith(".csv") and x[:10] < jour)
    avant = {}
    if snaps:
        for l in csv.DictReader(open(os.path.join(out, "snapshots", snaps[-1]), encoding="utf-8")):
            avant[l["neq"]] = l
    with open(os.path.join(out, "snapshots", jour + ".csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["neq", "nom", "muni", "statut", "date_statut", "immat", "cae", "emp", "rattachement"])
        for e in sorted(ent.values(), key=lambda e: e["neq"]):
            w.writerow([e["neq"], e.get("nom", ""), e["muni"], e["statut"], e["date_statut"], e["immat"],
                        e["cae"], e["emp"], e["rattachement"]])
    if avant:
        f1 = lambda e: {"neq": e["neq"], "nom": e.get("nom", ""), "muni": e["muni"], "cae_desc": e.get("cae_desc", "")}
        mouv = {"_source": attribution, "depuis": snaps[-1][:10], "jusqu_a": jour,
                "nouvelles": [f1(e) for n, e in ent.items() if e["actif"] and n not in avant],
                "reactivees": [f1(e) for n, e in ent.items() if e["actif"] and n in avant and avant[n]["statut"].upper() != "IM"],
                "radiees": [f1(e) for n, e in ent.items() if not e["actif"] and n in avant and avant[n]["statut"].upper() == "IM"],
                "disparues_du_jeu": [n for n in avant if n not in ent and avant[n]["statut"].upper() == "IM"]}
        json.dump(mouv, open(os.path.join(out, "mouvements.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        diag.append("Mouvements depuis %s : +%d nouvelles, %d radiées, %d réactivées" %
                    (snaps[-1][:10], len(mouv["nouvelles"]), len(mouv["radiees"]), len(mouv["reactivees"])))
    diag.append("Actives par municipalité : %s" % resume["par_municipalite"])
    sans_nom = sum(1 for e in actifs if not e.get("nom"))
    diag.append("Actives sans nom apparié : %d sur %d" % (sans_nom, len(actifs)))
    open(os.path.join(out, "diagnostic.txt"), "w", encoding="utf-8").write("\n".join(diag) + "\n")
    print("\n".join(diag))
    if not ent:
        sys.exit("Aucune entreprise rattachée au Granit : vérifier les colonnes d'adresse dans le diagnostic.")


if __name__ == "__main__":
    main()
