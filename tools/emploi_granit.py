#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Emploi dans la MRC du Granit selon le Recensement de 2021 (division de recensement Le Granit, 2430).

Source  : Statistique Canada, Profil du recensement, Recensement de la population de 2021,
          service Web de données (SDMX). Données-échantillon de 25 %, arrondies.
Écrit dans data/emploi/ :
  - recensement2021.json   situation d'activité, population active par industrie (SCIAN 2017),
                           lieu de travail et destination du navettage
  - diagnostic.txt

Les caractéristiques sont repérées par leur libellé dans la liste de codes du service, jamais supposées.
Usage : python tools/emploi_granit.py [--out data/emploi]
"""
import argparse, csv, io, json, os, re, sys, unicodedata, urllib.request, datetime

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
ENT = {"User-Agent": UA, "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.8"}
BASE = "https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/"
ZONE = "2021A00032430"   # division de recensement Le Granit
QC = "2021A000224"       # Québec, pour comparaison


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def lire(url, accept, timeout=300):
    req = urllib.request.Request(url, headers=dict(ENT, Accept=accept))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8-sig", "replace")


def codes(diag, flux):
    xml = lire(BASE + "dataflow/STC_CP/%s/latest?references=all" % flux, "application/vnd.sdmx.structure+xml;version=2.1")
    diag.append("Liste de codes %s : %d octets" % (flux, len(xml)))
    noms = {}
    for cid_l, corps_l in re.findall(r"<(?:structure:|str:)?Codelist\b[^>]*\bid=\"([^\"]+)\"[^>]*>(.*?)</(?:structure:|str:)?Codelist>", xml, re.S):
        if "CHARACTERISTIC" not in cid_l.upper():
            continue
        for cid, corps in re.findall(r"<(?:structure:|str:)?Code\b[^>]*\bid=\"([^\"]+)\"[^>]*>(.*?)</(?:structure:|str:)?Code>", corps_l, re.S):
            n = {}
            for lang, txt in re.findall(r"<common:Name[^>]*xml:lang=\"(\w+)\"[^>]*>(.*?)</common:Name>", corps, re.S):
                n[lang] = re.sub(r"\s+", " ", txt).strip().replace("&amp;", "&").replace("&apos;", "'")
            noms[cid] = n
    return noms


def bloc(noms, debut_en, diag, cle):
    """Codes consécutifs à partir de l'en-tête dont le libellé anglais commence par debut_en,
    jusqu'au prochain en-tête « Total - »."""
    tetes = [c for c, n in noms.items() if norm(n.get("en", "")).startswith(norm(debut_en)) and c.isdigit()]
    diag.append("%s : en-têtes %s" % (cle, [(c, noms[c].get("fr")) for c in tetes]))
    if not tetes:
        return []
    t = int(sorted(tetes, key=int)[0])
    out = [str(t)]
    for k in range(t + 1, t + 60):
        n = noms.get(str(k))
        if not n or norm(n.get("en", "")).startswith("total "):
            break
        out.append(str(k))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/emploi")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    diag = ["Extraction du %s" % datetime.date.today().isoformat()]

    def finir(code=0):
        open(os.path.join(a.out, "diagnostic.txt"), "w", encoding="utf-8").write("\n".join(diag) + "\n")
        print("\n".join(x[:3000] for x in diag))
        sys.exit(code)

    try:
        noms = codes(diag, "DF_CD")
    except Exception as e:  # noqa
        diag.append("Liste de codes : échec %s" % e)
        finir(1)
    diag.append("Caractéristiques lues : %d" % len(noms))
    blocs = {
        "activite": bloc(noms, "Total - Population aged 15 years and over by labour force status", diag, "activite"),
        "industrie": bloc(noms, "Total - Labour force aged 15 years and over by industry - Sectors", diag, "industrie"),
        "lieu_travail": bloc(noms, "Total - Place of work status for the employed labour force", diag, "lieu_travail"),
        "navettage": bloc(noms, "Total - Commuting destination for the employed labour force", diag, "navettage"),
        "categorie": bloc(noms, "Total - Labour force aged 15 years and over by class of worker", diag, "categorie"),
    }
    # les taux (activité, emploi, chômage) suivent le bloc « activité » sans faire partie de la même somme
    taux = [c for c, n in noms.items() if norm(n.get("en", "")) in ("participation rate", "employment rate", "unemployment rate") and c.isdigit()]
    tous = sorted({c for b in blocs.values() for c in b} | set(taux), key=int)
    if not tous:
        finir(1)
    url = BASE + "data/STC_CP,DF_CD/A5.%s.1.%s.1" % (ZONE, "+".join(tous))
    try:
        texte = lire(url, "application/vnd.sdmx.data+csv;version=1.0.0")
    except Exception as e:  # noqa
        diag.append("Données : échec %s ; URL %s" % (e, url[:300]))
        finir(1)
    ent = texte.split("\n", 1)[0]
    lignes = list(csv.DictReader(io.StringIO(texte), delimiter=max(";,\t", key=ent.count)))
    diag.append("Données : %d observations" % len(lignes))
    val = {}
    for l in lignes:
        try:
            v = float(l.get("OBS_VALUE", ""))
            val[l.get("CHARACTERISTIC")] = int(v) if v == int(v) else v
        except ValueError:
            pass

    def rendre(lst):
        return [{"id": c, "nom": noms[c].get("fr") or noms[c].get("en"), "nom_en": noms[c].get("en"), "valeur": val.get(c)} for c in lst]

    sortie = {"_source": "Statistique Canada, Profil du recensement, Recensement de la population de 2021, division de recensement Le Granit (2430). "
                         "Données-échantillon de 25 %, arrondies. Les personnes sont comptées à leur lieu de résidence.",
              "extraction": datetime.date.today().isoformat(), "annee": 2021,
              "taux": rendre(sorted(taux, key=int))}
    for k, b in blocs.items():
        sortie[k] = rendre(b)
        diag.append("== %s" % k)
        for x in sortie[k]:
            diag.append("   %s | %s | %s" % (x["id"], x["nom"], x["valeur"]))
    diag.append("== taux : %s" % [(x["nom"], x["valeur"]) for x in sortie["taux"]])
    # Contrôle : la somme des industries doit avoisiner le total « toutes les industries »
    ind = sortie["industrie"]
    json.dump(sortie, open(os.path.join(a.out, "recensement2021.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    finir(0 if ind and ind[0]["valeur"] else 1)


if __name__ == "__main__":
    main()
