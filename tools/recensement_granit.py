#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parc de logements des 19 municipalités de la MRC du Granit selon le Recensement de 2021.

Source  : Statistique Canada, Profil du recensement, Recensement de la population de 2021
          (produit 98-401-X2021006, subdivisions de recensement du Québec).
Licence : Licence du gouvernement ouvert de Statistique Canada.

Ce script ne modifie PAS data.json. Il écrit dans data/logement/ :
  - recensement2021.json   par municipalité : logements privés, logements occupés par des résidents
                           habituels, ménages propriétaires et locataires
  - diagnostic.txt         caractéristiques retenues et contrôles

Les données du recensement ne changent pas d'une extraction à l'autre. Le script sert à remplacer
les estimations par des valeurs officielles, puis à recommencer lors de la diffusion du Recensement de 2026.

Usage : python tools/recensement_granit.py [--zip fichier.zip] [--out data/logement]
"""
import argparse, csv, io, json, os, re, sys, unicodedata, urllib.request, zipfile, datetime

URLS = [
    "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/download-telecharger/comp/GetFile.cfm?Lang=F&FILETYPE=CSV&GEONO=006_Quebec",
    "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/download-telecharger/comp/GetFile.cfm?Lang=E&FILETYPE=CSV&GEONO=006_Quebec",
]
UA = "Mozilla/5.0 (compatible; tableau-de-bord-MRC-du-Granit; +https://github.com/JosianeP/granit-dashboard_test)"
CODES = {"30030": "Lac-Mégantic", "30025": "Frontenac", "30095": "Lambton", "30045": "Nantes", "30010": "Notre-Dame-des-Bois",
         "30110": "Stratford", "30080": "Lac-Drolet", "30072": "Saint-Ludger", "30035": "Marston", "30050": "Sainte-Cécile-de-Whitton",
         "30100": "Saint-Romain", "30055": "Audet", "30085": "Saint-Sébastien", "30005": "Saint-Augustin-de-Woburn",
         "30105": "Stornoway", "30070": "Saint-Robert-Bellarmin", "30020": "Piopolis", "30040": "Milan", "30015": "Val-Racine"}
SDR = {"24" + c: m for c, m in CODES.items()}
csv.field_size_limit(10**9)


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


# clé de sortie -> motifs (nom normalisé de la caractéristique, français ou anglais)
CARACS = {
    "logements_prives": ["total des logements prives", "total private dwellings"],
    "logements_occupes": ["logements prives occupes par des residents habituels", "private dwellings occupied by usual residents"],
    "menages_mode_occupation": ["total menages prives selon le mode d occupation", "total private households by tenure"],
    "proprietaires": ["proprietaire", "owner"],
    "locataires": ["locataire", "renter"],
    "population_2021": ["population 2021", "population 2021"],
}


def telecharger(dest, diag):
    for url in URLS:
        try:
            print("Téléchargement :", url)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=900) as r, open(dest, "wb") as f:
                n = 0
                while True:
                    bloc = r.read(1 << 20)
                    if not bloc:
                        break
                    f.write(bloc); n += len(bloc)
            debut = open(dest, "rb").read(4)
            diag.append("Téléchargé %s : %d octets, signature %r" % (url, n, debut))
            if debut[:2] == b"PK":
                return url
            diag.append("Pas un ZIP. Début du contenu : %r" % open(dest, "rb").read(600))
        except Exception as e:  # noqa
            diag.append("Échec %s : %s" % (url, e))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip")
    ap.add_argument("--out", default="data/logement")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    diag = ["Extraction du %s" % datetime.date.today().isoformat()]
    chemin = a.zip or "/tmp/recensement2021_qc.zip"
    url = "fichier local" if a.zip else telecharger(chemin, diag)

    def finir(code=0):
        open(os.path.join(a.out, "diagnostic.txt"), "w", encoding="utf-8").write("\n".join(diag) + "\n")
        print("\n".join(diag))
        sys.exit(code)

    if not url:
        finir(1)
    z = zipfile.ZipFile(chemin)
    noms = z.namelist()
    diag.append("Fichiers du ZIP : %s" % noms)
    donnees = [n for n in noms if n.lower().endswith(".csv") and "data" in n.lower()] or [n for n in noms if n.lower().endswith(".csv")]
    trouve = {}  # muni -> clé -> (valeur, nom de la caractéristique, id)
    apercu = {}
    for nom in donnees:
        with z.open(nom) as f:
            lecteur = csv.reader(io.TextIOWrapper(f, encoding="latin-1", newline=""))
            ent = next(lecteur)
            idx = {norm(h): i for i, h in enumerate(ent)}
            if nom == donnees[0]:
                diag.append("%s : colonnes %s" % (nom, ent))
            def col(*motifs):
                for m in motifs:
                    for k, i in idx.items():
                        if m in k:
                            return i
                return None
            i_geo = col("alt geo code", "geo code")
            i_dguid = col("dguid")
            i_cid = col("characteristic id", "id caracteristique")
            i_cnom = col("characteristic name", "nom caracteristique")
            i_val = col("c1 count total", "c1 chiffre total")
            if None in (i_cnom, i_val) or (i_geo is None and i_dguid is None):
                diag.append("%s : colonnes attendues absentes, fichier ignoré" % nom)
                continue
            for l in lecteur:
                if len(l) <= max(i_cnom, i_val):
                    continue
                code = (l[i_geo] if i_geo is not None else "").strip()
                if code not in SDR and i_dguid is not None:
                    code = l[i_dguid].strip()[-7:]
                if code not in SDR:
                    continue
                muni = SDR[code]
                brut = l[i_cnom]
                k = norm(brut)
                cid = l[i_cid].strip() if i_cid is not None else ""
                if muni == "Lac-Mégantic" and len(apercu) < 2700:
                    apercu[cid] = (brut.strip(), l[i_val])
                for cle, motifs in CARACS.items():
                    exact = cle in ("proprietaires", "locataires")
                    if (k in motifs) if exact else any(k.startswith(m) for m in motifs):
                        if cle in ("proprietaires", "locataires"):
                            # « Propriétaire » et « Locataire » apparaissent plusieurs fois dans le profil : ne retenir que
                            # les lignes qui suivent immédiatement le total des ménages selon le mode d'occupation.
                            der = trouve.get(muni, {}).get("_dernier_total")
                            try:
                                if der is None or not (0 < int(cid) - int(der) <= 3):
                                    continue
                            except ValueError:
                                continue
                        if cle in trouve.get(muni, {}):
                            continue
                        try:
                            v = float(l[i_val])
                            v = int(v) if v == int(v) else v
                        except ValueError:
                            v = None
                        trouve.setdefault(muni, {})[cle] = {"valeur": v, "caracteristique": brut.strip(), "id": cid}
                        if cle == "menages_mode_occupation":
                            trouve[muni]["_dernier_total"] = cid
    diag.append("Caractéristiques retenues pour Lac-Mégantic : %s" % {k: v for k, v in trouve.get("Lac-Mégantic", {}).items() if k != "_dernier_total"})
    diag.append("Aperçu des caractéristiques de logement (Lac-Mégantic) : %s" %
                [(i, n, v) for i, (n, v) in apercu.items() if re.search(r"logement|dwelling|occupation|tenure|locataire|renter", n, re.I)][:60])

    par_muni = {}
    for code, muni in CODES.items():
        t = trouve.get(muni, {})
        g = lambda c: (t.get(c) or {}).get("valeur")
        par_muni[muni] = {"code": code, "logements_prives": g("logements_prives"), "logements_occupes": g("logements_occupes"),
                          "menages": g("menages_mode_occupation"), "proprietaires": g("proprietaires"), "locataires": g("locataires"),
                          "population_2021": g("population_2021")}
    manquants = [m for m, v in par_muni.items() if v["logements_occupes"] is None]
    diag.append("Municipalités sans valeur : %s" % manquants)
    # Contrôles : valeurs déjà validées à la main dans le tableau de bord
    for m, attendu in (("Lac-Mégantic", 2938), ("Nantes", 609)):
        diag.append("Contrôle %s : logements occupés = %s (attendu %s)" % (m, par_muni[m]["logements_occupes"], attendu))
    for m, v in par_muni.items():
        diag.append("  %s : %s" % (m, v))
    car = {k: {"caracteristique": v["caracteristique"], "id": v["id"]} for k, v in trouve.get("Lac-Mégantic", {}).items() if k != "_dernier_total"}
    out = {"_source": "Statistique Canada, Profil du recensement, Recensement de la population de 2021 (produit 98-401-X2021006), "
                      "subdivisions de recensement. Les ménages selon le mode d'occupation proviennent de l'échantillon de 25 % et sont arrondis.",
           "extraction": datetime.date.today().isoformat(), "caracteristiques": car, "par_municipalite": par_muni}
    json.dump(out, open(os.path.join(a.out, "recensement2021.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    finir(1 if len(manquants) == len(CODES) else 0)


if __name__ == "__main__":
    main()
