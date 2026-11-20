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
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
ENTETES = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.8"}
# Service Web de données du Profil du recensement de 2021 (SDMX). Clé : fréquence.région.genre.caractéristique.statistique
API = "https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/data/STC_CP,DF_CSD/A5.%s.1.%s.1"
# 1 population 2021; 4 total des logements privés; 5 logements privés occupés par des résidents habituels;
# 1414 total des ménages privés selon le mode d'occupation; 1415 propriétaire; 1416 locataire
API_CARACS = {"1": "population_2021", "4": "logements_prives", "5": "logements_occupes",
              "1414": "menages", "1415": "proprietaires", "1416": "locataires"}
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
            req = urllib.request.Request(url, headers=ENTETES)
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


def par_api(out, diag, finir):
    """Solution de rechange : interroger le service Web de données, une requête pour les 19 municipalités."""
    regions = "+".join("2021A0005" + c for c in SDR)
    url = API % (regions, "+".join(API_CARACS))
    texte = None
    for accept in ("application/vnd.sdmx.data+csv;version=1.0.0", "text/csv", "application/vnd.sdmx.data+json;version=1.0.0", "*/*"):
        try:
            req = urllib.request.Request(url, headers=dict(ENTETES, Accept=accept))
            with urllib.request.urlopen(req, timeout=300) as r:
                octets = r.read()
                diag.append("API (%s) : HTTP %s, %s, %d octets" % (accept, r.status, r.headers.get("Content-Type"), len(octets)))
                texte = octets.decode("utf-8-sig", "replace")
                diag.append("API, début de la réponse : %r" % texte[:1200])
                if texte.lstrip()[:1] not in ("<", "{") and "," in texte.split("\n", 1)[0]:
                    break
                texte = None
        except Exception as e:  # noqa
            corps = ""
            try:
                corps = e.read()[:400]
            except Exception:  # noqa
                pass
            diag.append("API (%s) : échec %s %r" % (accept, e, corps))
    if not texte:
        diag.append("URL interrogée : " + url)
        finir(1)
    lignes = list(csv.DictReader(io.StringIO(texte)))
    diag.append("API : %d observations, colonnes %s" % (len(lignes), list(lignes[0].keys()) if lignes else []))
    par_muni = {m: {"code": c} for c, m in CODES.items()}
    for l in lignes:
        zone = (l.get("REF_AREA") or l.get("GEO") or "")[-7:]
        car = l.get("CHARACTERISTIC") or l.get("CHARACTERISTICS") or ""
        if zone not in SDR or car not in API_CARACS:
            continue
        try:
            v = float(l.get("OBS_VALUE", ""))
            v = int(v) if v == int(v) else v
        except ValueError:
            v = None
        par_muni[SDR[zone]][API_CARACS[car]] = v
    for m, v in par_muni.items():
        for k in API_CARACS.values():
            v.setdefault(k, None)
        # Garde-fou : propriétaires + locataires doit égaler le total des ménages (échantillon de 25 %, arrondi à 5 près).
        if None not in (v["menages"], v["proprietaires"], v["locataires"], v["logements_occupes"]):
            v["controle_mode_occupation"] = abs(v["proprietaires"] + v["locataires"] - v["menages"]) <= 15 and abs(v["menages"] - v["logements_occupes"]) <= 25
        else:
            v["controle_mode_occupation"] = False
        diag.append("  %s : %s" % (m, v))
    for m, attendu in (("Lac-Mégantic", 2938), ("Nantes", 609)):
        diag.append("Contrôle %s : logements occupés = %s (attendu %s)" % (m, par_muni[m]["logements_occupes"], attendu))
    manquants = [m for m, v in par_muni.items() if v["logements_occupes"] is None]
    diag.append("Municipalités sans valeur : %s" % manquants)
    json.dump({"_source": "Statistique Canada, Profil du recensement, Recensement de la population de 2021, subdivisions de recensement "
                          "(service Web de données). Les ménages selon le mode d'occupation proviennent de l'échantillon de 25 % et sont arrondis.",
               "extraction": datetime.date.today().isoformat(), "methode": "api",
               "caracteristiques": {v: {"id": k} for k, v in API_CARACS.items()}, "par_municipalite": par_muni},
              open(os.path.join(out, "recensement2021.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    finir(1 if len(manquants) == len(CODES) else 0)


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
        par_api(a.out, diag, finir)
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
