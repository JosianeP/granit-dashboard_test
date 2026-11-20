#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Contours des 19 municipalités de la MRC du Granit, pour la carte du tableau de bord.

Source privilégiée : Système sur les découpages administratifs (SDA) du ministère des Ressources
naturelles et des Forêts du Québec, service cartographique public.
Source de rechange : OpenStreetMap (Nominatim), licence ODbL, « © les contributeurs d'OpenStreetMap ».

Écrit dans data/carte/ :
  - municipalites.geojson   un polygone simplifié par municipalité (propriétés : code, nom, source)
  - diagnostic.txt          ce qui a été interrogé et retenu

Les limites municipales changent rarement : ce script se lance à la main (onglet Actions).
Usage : python tools/carte_granit.py [--out data/carte]
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request, datetime, math

UA = "tableau-de-bord-MRC-du-Granit/1.0 (+https://github.com/JosianeP/granit-dashboard_test)"
CODES = {"30030": "Lac-Mégantic", "30025": "Frontenac", "30095": "Lambton", "30045": "Nantes", "30010": "Notre-Dame-des-Bois",
         "30110": "Stratford", "30080": "Lac-Drolet", "30072": "Saint-Ludger", "30035": "Marston", "30050": "Sainte-Cécile-de-Whitton",
         "30100": "Saint-Romain", "30055": "Audet", "30085": "Saint-Sébastien", "30005": "Saint-Augustin-de-Woburn",
         "30105": "Stornoway", "30070": "Saint-Robert-Bellarmin", "30020": "Piopolis", "30040": "Milan", "30015": "Val-Racine"}
SDA = "https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/SDA_WMS/MapServer"
TOL = 0.0006  # tolérance de simplification, en degrés (environ 50 m)
BOITE = (-71.75, 45.15, -70.35, 46.05)  # ouest, sud, est, nord : garde-fou contre les homonymes


def lire(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def simplifier(pts, tol):
    """Douglas-Peucker itératif sur une ligne fermée."""
    if len(pts) < 5:
        return pts
    garde = [False] * len(pts)
    garde[0] = garde[-1] = True
    pile = [(0, len(pts) - 1)]
    while pile:
        a, b = pile.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy)
        dmax, imax = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / n if n else math.hypot(px - ax, py - ay)
            if d > dmax:
                dmax, imax = d, i
        if dmax > tol and imax > 0:
            garde[imax] = True
            pile.append((a, imax)); pile.append((imax, b))
    out = [p for p, g in zip(pts, garde) if g]
    return out if len(out) >= 4 else pts


def nettoyer(geom):
    """Ramène une géométrie à un MultiPolygon simplifié, coordonnées à 5 décimales."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = []
    for poly in polys:
        anneaux = []
        for k, anneau in enumerate(poly):
            s = simplifier([(float(x), float(y)) for x, y in (c[:2] for c in anneau)], TOL)
            if len(s) >= 4 and (k == 0 or len(s) >= 6):
                anneaux.append([[round(x, 5), round(y, 5)] for x, y in s])
        if anneaux:
            out.append(anneaux)
    return {"type": "MultiPolygon", "coordinates": out}


def centre(geom):
    xs = [p[0] for poly in geom["coordinates"] for p in poly[0]]
    ys = [p[1] for poly in geom["coordinates"] for p in poly[0]]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def dans_boite(geom):
    x, y = centre(geom)
    return BOITE[0] <= x <= BOITE[2] and BOITE[1] <= y <= BOITE[3]


def par_sda(diag):
    """Interroge le service du SDA : repère la couche des municipalités et le champ du code géographique."""
    res = {}
    try:
        svc = lire(SDA + "?f=json")
    except Exception as e:  # noqa
        diag.append("SDA : service inaccessible (%s)" % e)
        return res
    couches = [(c["id"], c["name"]) for c in svc.get("layers", [])]
    diag.append("SDA : couches %s" % couches)
    cand = [c for c in couches if "munic" in c[1].lower()]
    for cid, cnom in cand:
        try:
            info = lire("%s/%d?f=json" % (SDA, cid))
            champs = [f["name"] for f in info.get("fields", [])]
            diag.append("SDA couche %d « %s » : champs %s" % (cid, cnom, champs))
            code = next((f for f in champs if f.upper() in ("MUS_CO_GEO", "CO_GEO", "CODE_GEO", "MUS_CO_GEO_")), None) or \
                next((f for f in champs if "CO_GEO" in f.upper()), None)
            if not code:
                continue
            ech = lire("%s/%d/query?%s" % (SDA, cid, urllib.parse.urlencode(
                {"where": "1=1", "outFields": "*", "returnGeometry": "false", "resultRecordCount": 2, "f": "json"})))
            diag.append("SDA couche %d : échantillon %s" % (cid, [f.get("attributes") for f in ech.get("features", [])][:2]))
            for forme in ("'%s'", "%s", "'24%s'"):
                where = "%s IN (%s)" % (code, ",".join(forme % c for c in CODES))
                try:
                    g = lire("%s/%d/query?%s" % (SDA, cid, urllib.parse.urlencode(
                        {"where": where, "outFields": "*", "outSR": 4326, "geometryPrecision": 5, "f": "geojson"})), timeout=300)
                except Exception as e:  # noqa
                    diag.append("SDA couche %d, %s : %s" % (cid, forme, e))
                    continue
                feats = g.get("features", [])
                diag.append("SDA couche %d, filtre %s : %d entités" % (cid, forme, len(feats)))
                for f in feats:
                    c = str(f["properties"].get(code, ""))[-5:]
                    if c in CODES and f.get("geometry") and f["geometry"]["type"] in ("Polygon", "MultiPolygon"):
                        geom = nettoyer(f["geometry"])
                        if geom["coordinates"] and dans_boite(geom):
                            if c in res:  # plusieurs morceaux pour un même code : les réunir
                                res[c]["coordinates"] += geom["coordinates"]
                            else:
                                res[c] = geom
                if len(res) == len(CODES):
                    diag.append("SDA : %d municipalités obtenues de la couche %d « %s »" % (len(res), cid, cnom))
                    return res
        except Exception as e:  # noqa
            diag.append("SDA couche %d : %s" % (cid, e))
    return res


def par_osm(diag, manquants):
    res = {}
    for code in manquants:
        nom = CODES[code]
        for requete in ("%s, Le Granit, Québec, Canada" % nom, "%s, Estrie, Québec, Canada" % nom):
            url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
                {"q": requete, "format": "jsonv2", "polygon_geojson": 1, "limit": 5, "countrycodes": "ca"})
            try:
                r = lire(url)
            except Exception as e:  # noqa
                diag.append("OSM %s : %s" % (nom, e)); time.sleep(1.2); continue
            time.sleep(1.2)  # politique d'usage de Nominatim : une requête par seconde au plus
            ok = [x for x in r if x.get("geojson", {}).get("type") in ("Polygon", "MultiPolygon")
                  and x.get("category") == "boundary" and x.get("type") == "administrative"]
            for x in ok:
                geom = nettoyer(x["geojson"])
                if geom["coordinates"] and dans_boite(geom):
                    res[code] = geom
                    diag.append("OSM %s : retenu « %s » (osm %s %s)" % (nom, x.get("display_name"), x.get("osm_type"), x.get("osm_id")))
                    break
            if code in res:
                break
        if code not in res:
            diag.append("OSM %s : aucun contour" % nom)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/carte")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    diag = ["Extraction du %s" % datetime.date.today().isoformat()]
    sda = par_sda(diag)
    manquants = [c for c in CODES if c not in sda]
    osm = par_osm(diag, manquants) if manquants else {}
    feats = []
    for code, nom in CODES.items():
        geom = sda.get(code) or osm.get(code)
        if not geom:
            continue
        cx, cy = centre(geom)
        feats.append({"type": "Feature", "properties": {"code": code, "nom": nom, "source": "SDA" if code in sda else "OSM",
                                                         "centre": [round(cx, 5), round(cy, 5)]}, "geometry": geom})
    n_sda, n_osm = sum(1 for f in feats if f["properties"]["source"] == "SDA"), sum(1 for f in feats if f["properties"]["source"] == "OSM")
    src = []
    if n_sda:
        src.append("Système sur les découpages administratifs (SDA), ministère des Ressources naturelles et des Forêts du Québec")
    if n_osm:
        src.append("© les contributeurs d'OpenStreetMap (ODbL)")
    pts = sum(len(r) for f in feats for p in f["geometry"]["coordinates"] for r in p)
    diag.append("Municipalités : %d sur %d (SDA %d, OSM %d), %d points au total" % (len(feats), len(CODES), n_sda, n_osm, pts))
    json.dump({"type": "FeatureCollection", "_source": "Limites municipales : " + " ; ".join(src) + ". Contours simplifiés pour l'affichage.",
               "extraction": datetime.date.today().isoformat(), "features": feats},
              open(os.path.join(a.out, "municipalites.geojson"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(a.out, "diagnostic.txt"), "w", encoding="utf-8").write("\n".join(diag) + "\n")
    print("\n".join(d[:1500] for d in diag))
    if len(feats) < len(CODES):
        sys.exit("Contours manquants : voir diagnostic.txt")


if __name__ == "__main__":
    main()
