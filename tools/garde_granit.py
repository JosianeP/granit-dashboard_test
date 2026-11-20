#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction des services de garde éducatifs à l'enfance de la MRC du Granit (données ouvertes).

Sources (ministère de la Famille, Données Québec, licence CC-BY 4.0) :
  - Liste des centres de la petite enfance (CPE) et des garderies en fonction
  - Liste des bureaux coordonnateurs de la garde éducative en milieu familial

Ce script ne modifie PAS data.json. Il écrit dans data/garde/ :
  - granit_latest.json   installations (CPE, garderies) situées dans les 19 municipalités,
                         et bureau(x) coordonnateur(s) du territoire
  - resume.json          décomptes et places par municipalité et par type
  - historique.json      une ligne par extraction (installations, places), pour suivre l'évolution
  - diagnostic.txt       en-têtes lus, colonnes retenues, rejets, pour valider la qualité

Usage : python tools/garde_granit.py [--out data/garde] [--inst fichier.csv] [--bc fichier.csv]
"""
import argparse, csv, datetime, io, json, os, re, sys, unicodedata, urllib.request

CKAN = "https://www.donneesquebec.ca/recherche/api/3/action/package_show?id="
JEU_INST = "be36f85e-e419-4978-9c34-cb5795622595"
JEU_BC = "ed951823-4179-415b-bb25-b009320450e6"
URL_INST_SECOURS = ("https://www.donneesquebec.ca/recherche/dataset/be36f85e-e419-4978-9c34-cb5795622595/"
                    "resource/89af3537-4506-488c-8d0e-6d85b4033a0e/download/repertoire-installation.csv")
UA = "Mozilla/5.0 (compatible; tableau-de-bord-MRC-du-Granit; +https://github.com/JosianeP/granit-dashboard_test)"

MUNIS = ["Lac-Mégantic", "Frontenac", "Lambton", "Nantes", "Notre-Dame-des-Bois", "Stratford",
         "Lac-Drolet", "Saint-Ludger", "Marston", "Sainte-Cécile-de-Whitton", "Saint-Romain",
         "Audet", "Saint-Sébastien", "Saint-Augustin-de-Woburn", "Stornoway",
         "Saint-Robert-Bellarmin", "Piopolis", "Milan", "Val-Racine"]
# Mêmes garde-fous que pour le Registre des entreprises : les régions de tri d'acheminement
# servent à écarter les municipalités homonymes situées ailleurs au Québec.
RTA_OK = {"G6B", "G0Y", "G0M"}
RTA_PAR_MUNI = {"Notre-Dame-des-Bois": {"J0B"}}
ALIAS = {"woburn": "Saint-Augustin-de-Woburn", "megantic": "Lac-Mégantic",
         "sainte cecile": "Sainte-Cécile-de-Whitton", "saint robert": "Saint-Robert-Bellarmin",
         "saint sebastien de frontenac": "Saint-Sébastien", "saint romain de winslow": "Saint-Romain"}
CP_RE = re.compile(r"\b([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"\bste\b", "sainte", s)
    s = re.sub(r"\bst\b", "saint", s)
    return s


MUNI_KEY = {norm(m): m for m in MUNIS}
MUNI_KEY.update(ALIAS)


def lire_url(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def ressource_csv(jeu, diag):
    """Retourne (url, date de dernière modification) de la ressource CSV d'un jeu de Données Québec."""
    try:
        meta = json.loads(lire_url(CKAN + jeu).decode("utf-8"))
        res = [r for r in meta["result"]["resources"] if (r.get("format") or "").upper() == "CSV"]
        res.sort(key=lambda r: r.get("last_modified") or r.get("created") or "", reverse=True)
        r = res[0]
        diag.append("Jeu %s : ressource « %s », modifiée le %s, %s" % (jeu, r.get("name"), r.get("last_modified"), r.get("url")))
        return r["url"], (r.get("last_modified") or "")[:10]
    except Exception as e:  # noqa
        diag.append("Jeu %s : métadonnées illisibles (%s)" % (jeu, e))
        return None, ""


def decoder(octets):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return octets.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return octets.decode("utf-8", "replace"), "utf-8 (avec remplacements)"


def lire_csv(octets, diag, nom):
    texte, enc = decoder(octets)
    premiere = texte.split("\n", 1)[0]
    sep = max([";", ",", "\t", "|"], key=premiere.count)
    lignes = list(csv.reader(io.StringIO(texte), delimiter=sep))
    entetes = [h.strip() for h in lignes[0]]
    diag.append("%s : encodage %s, séparateur %r, %d lignes" % (nom, enc, sep, len(lignes) - 1))
    diag.append("%s : colonnes %s" % (nom, entetes))
    return entetes, [dict(zip(entetes, [c.strip() for c in l])) for l in lignes[1:] if any(c.strip() for c in l)]


def trouver(entetes, *motifs, exclure=()):
    """Colonne dont le nom normalisé égale l'un des motifs, sinon première colonne qui en contient un."""
    for m in motifs:
        for h in entetes:
            if norm(h) == m:
                return h
    for m in motifs:
        for h in entetes:
            k = norm(h)
            if m in k and not any(x in k for x in exclure):
                return h
    return None


def entier(v):
    v = re.sub(r"[^\d]", "", str(v or ""))
    return int(v) if v else None


def municipalite(ligne, col_muni, col_cp, rejets):
    """Municipalité du Granit correspondant à la ligne, ou None."""
    brut = ligne.get(col_muni, "") if col_muni else ""
    muni = MUNI_KEY.get(norm(brut))
    if not muni:
        return None
    cp = ""
    if col_cp:
        m = CP_RE.search(ligne.get(col_cp, ""))
        cp = (m.group(1) + m.group(2)).upper() if m else ""
    if not cp:  # code postal absent de sa colonne : le chercher dans toute la ligne
        m = CP_RE.search(" ".join(ligne.values()))
        cp = (m.group(1) + m.group(2)).upper() if m else ""
    if cp and cp[:3] not in (RTA_OK | RTA_PAR_MUNI.get(muni, set())):
        rejets.append("%s (%s)" % (brut, cp))
        return None
    return muni


def classer(type_brut, subv):
    """TYPE vaut CPE ou GARD; SUBV vaut CR (places à contribution réduite, donc subventionnées) ou autre chose."""
    t, s = norm(type_brut), norm(subv)
    if t == "cpe" or "centre de la petite enfance" in t:
        return "cpe"
    if t.startswith("gard"):
        if s == "cr":
            return "garderie_subventionnee"
        return "garderie_non_subventionnee" if s else "garderie"
    return "autre"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/garde")
    ap.add_argument("--inst")
    ap.add_argument("--bc")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    aujourdhui = datetime.date.today().isoformat()
    diag = ["Extraction du %s" % aujourdhui]

    # ── Installations (CPE et garderies) ──
    if a.inst:
        octets, maj_inst = open(a.inst, "rb").read(), ""
    else:
        url, maj_inst = ressource_csv(JEU_INST, diag)
        octets = lire_url(url or URL_INST_SECOURS)
    ent, lignes = lire_csv(octets, diag, "Installations")
    c_muni = trouver(ent, "nom mun compo", "nom mun", "municipalite", "ville", "localite", exclure=("region", "mrc"))
    c_cp = trouver(ent, "code postal", "postal")
    c_nom = trouver(ent, "nom", "nom installation", "nom de l installation", "installation", exclure=("numero", "no ", "mun", "region", "mrc", "bureau", "terr"))
    c_ent = trouver(ent, "nom entreprise", "nom de l entreprise", "titulaire", "raison sociale", "entreprise", exclure=("numero", "no "))
    c_type = trouver(ent, "type", "categorie", "sous type")
    c_adr = trouver(ent, "adresse", "rue")
    c_tel = trouver(ent, "telephone1", "telephone", "tel")
    c_subv = trouver(ent, "subv")
    c_web = trouver(ent, "internet", "courriel")
    c_mrc = trouver(ent, "mrc")
    c_no = trouver(ent, "numero installation", "no installation", "numero", "no ")
    cols_places = [h for h in ent if "place" in norm(h)]
    c_tot = trouver(cols_places, "place total", "places total", "total", "permis") or (cols_places[0] if cols_places else None)
    c_poup = trouver(cols_places, "poupon", "0 17", "moins de 18")
    diag.append("Colonnes retenues : %s" % {"municipalité": c_muni, "code postal": c_cp, "nom": c_nom, "entreprise": c_ent, "type": c_type,
                                             "adresse": c_adr, "subvention": c_subv, "MRC": c_mrc, "numéro": c_no, "places (toutes)": cols_places,
                                             "places totales": c_tot, "poupons": c_poup})
    if c_type:
        types = {}
        for l in lignes:
            types[l.get(c_type, "")] = types.get(l.get(c_type, ""), 0) + 1
        diag.append("Valeurs de « %s » (tout le Québec) : %s" % (c_type, sorted(types.items(), key=lambda x: -x[1])[:25]))
    if c_subv:
        sv = {}
        for l in lignes:
            sv[(l.get(c_type, ""), l.get(c_subv, ""))] = sv.get((l.get(c_type, ""), l.get(c_subv, "")), 0) + 1
        diag.append("Valeurs de (type, « %s ») : %s" % (c_subv, sorted(sv.items(), key=lambda x: -x[1])[:25]))

    rejets, inst = [], []
    for l in lignes:
        muni = municipalite(l, c_muni, c_cp, rejets)
        if not muni:
            # filet : une ligne dont la colonne MRC nomme le Granit mais dont la municipalité n'est pas reconnue
            if c_mrc and "granit" in norm(l.get(c_mrc, "")):
                diag.append("À vérifier (MRC Le Granit, municipalité non reconnue) : %s" % l)
            continue
        places = {h: entier(l.get(h)) for h in cols_places if entier(l.get(h)) is not None}
        tot = entier(l.get(c_tot)) if c_tot else None
        if tot is None and places:
            tot = sum(places.values())
        nom = l.get(c_nom, "") if c_nom else ""
        inst.append({
            "numero": l.get(c_no, "") if c_no else "", "nom": nom, "entreprise": l.get(c_ent, "") if c_ent else "",
            "type": classer(l.get(c_type, "") if c_type else "", l.get(c_subv, "") if c_subv else ""),
            "type_source": l.get(c_type, "") if c_type else "", "subvention_source": l.get(c_subv, "") if c_subv else "",
            "muni": muni, "adresse": l.get(c_adr, "") if c_adr else "", "telephone": l.get(c_tel, "") if c_tel else "",
            "courriel": l.get(c_web, "") if c_web else "",
            "places": tot, "poupons": entier(l.get(c_poup)) if c_poup else None,
        })
    inst.sort(key=lambda x: (MUNIS.index(x["muni"]), x["nom"]))
    diag.append("Installations retenues : %d ; rejets par code postal (homonymes) : %s" % (len(inst), rejets[:40]))
    for i in inst:
        diag.append("  - %s | %s | %s | %s places | %s" % (i["muni"], i["nom"], i["type_source"], i["places"], i["entreprise"]))

    # ── Bureaux coordonnateurs (milieu familial) ──
    bcs, maj_bc = [], ""
    try:
        if a.bc:
            octets_bc = open(a.bc, "rb").read()
        else:
            url_bc, maj_bc = ressource_csv(JEU_BC, diag)
            octets_bc = lire_url(url_bc) if url_bc else None
        if octets_bc:
            ent_b, lignes_b = lire_csv(octets_bc, diag, "Bureaux coordonnateurs")
            b_muni = trouver(ent_b, "nom mun compo", "nom mun", "municipalite", "ville", exclure=("region", "mrc", "territoire"))
            b_cp = trouver(ent_b, "code postal", "postal")
            b_nom = trouver(ent_b, "nom", exclure=("numero", "mun", "region", "terr", "nombre"))
            b_terr = trouver(ent_b, "nom terr", "territoire", "terr")
            b_rsg = trouver(ent_b, "nombre de rsg reconnues", "rsg")
            b_places = [h for h in ent_b if "place" in norm(h)]
            diag.append("BC, colonnes retenues : %s" % {"municipalité": b_muni, "nom": b_nom, "territoire": b_terr, "places": b_places})
            rej_b = []
            for l in lignes_b:
                muni = municipalite(l, b_muni, b_cp, rej_b)
                terr = l.get(b_terr, "") if b_terr else ""
                if not muni and "granit" not in norm(terr) and "granit" not in norm(" ".join(l.values())):
                    continue
                pl = {h: entier(l.get(h)) for h in b_places if entier(l.get(h)) is not None}
                bcs.append({"nom": l.get(b_nom, "") if b_nom else "", "muni": muni or "", "territoire": terr,
                            "places": max(pl.values()) if pl else None, "rsg_reconnues": entier(l.get(b_rsg)) if b_rsg else None, "brut": l})
            diag.append("Bureaux coordonnateurs retenus : %d" % len(bcs))
            for b in bcs:
                diag.append("  - %s" % b["brut"])
    except Exception as e:  # noqa
        diag.append("Bureaux coordonnateurs : lecture impossible (%s)" % e)

    # ── Résumés ──
    par_muni = {}
    for m in MUNIS:
        l = [i for i in inst if i["muni"] == m]
        par_muni[m] = {
            "installations": len(l),
            "cpe": sum(1 for i in l if i["type"] == "cpe"),
            "garderies": sum(1 for i in l if i["type"].startswith("garderie")),
            "garderies_subventionnees": sum(1 for i in l if i["type"] == "garderie_subventionnee"),
            "places": sum(i["places"] or 0 for i in l) if l else 0,
            "poupons": sum(i["poupons"] or 0 for i in l) if l else 0,
        }
    places_inst = sum(i["places"] or 0 for i in inst)
    places_mf = sum(b["places"] or 0 for b in bcs) if bcs else None
    source = ("Ministère de la Famille, Liste des centres de la petite enfance (CPE) et des garderies en fonction"
              + (" (fichier du %s)" % maj_inst if maj_inst else "") + " et Liste des bureaux coordonnateurs de la garde éducative en milieu familial"
              + (" (fichier du %s)" % maj_bc if maj_bc else "") + ", Données Québec, extraction du %s. Licence CC-BY 4.0." % aujourdhui)
    resume = {"_source": source, "extraction": aujourdhui, "fichier_installations": maj_inst, "fichier_bc": maj_bc,
              "installations": len(inst), "cpe": sum(1 for i in inst if i["type"] == "cpe"),
              "garderies": sum(1 for i in inst if i["type"].startswith("garderie")),
              "places_installation": places_inst, "places_milieu_familial": places_mf,
              "rsg_reconnues": (sum(b["rsg_reconnues"] or 0 for b in bcs) or None) if bcs else None,
              "places_poupons": sum(i["poupons"] or 0 for i in inst),
              "places_total": places_inst + (places_mf or 0), "par_municipalite": par_muni}
    for b in bcs:
        b.pop("brut", None)
    json.dump({"_source": source, "extraction": aujourdhui, "installations": inst, "bureaux_coordonnateurs": bcs},
              open(os.path.join(a.out, "granit_latest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(resume, open(os.path.join(a.out, "resume.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    chemin_h = os.path.join(a.out, "historique.json")
    hist = json.load(open(chemin_h, encoding="utf-8")) if os.path.exists(chemin_h) else {"serie": []}
    hist["serie"] = [s for s in hist["serie"] if s["date"] != aujourdhui]
    hist["serie"].append({"date": aujourdhui, "installations": len(inst), "places_installation": places_inst,
                          "places_milieu_familial": places_mf, "par_municipalite": {m: v["places"] for m, v in par_muni.items()}})
    json.dump(hist, open(chemin_h, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    open(os.path.join(a.out, "diagnostic.txt"), "w", encoding="utf-8").write("\n".join(diag) + "\n")
    print("\n".join(diag))
    if not inst:
        sys.exit("Aucune installation retenue : voir diagnostic.txt (colonnes non reconnues?).")


if __name__ == "__main__":
    main()
