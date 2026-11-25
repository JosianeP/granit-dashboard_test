/* granit-securite.js - Durcissement du tableau de bord. Chargé en premier, avant tout autre script.
   1. Assainit toute donnée avant affichage : data.json, fichiers de data/, JSON importé, stockage local, chiffrier.
      La plateforme insère ses données dans la page avec innerHTML; une chaîne piégée dans un fichier importé
      pourrait donc exécuter du code et lire le jeton de publication GitHub. Seules des balises de mise en forme
      sont conservées; scripts, gestionnaires d'événements et liens javascript: sont retirés.
   2. Vérifie le mot de passe du mode « Modifier les données » contre une empreinte PBKDF2 salée. Le mot de passe
      ne figure plus en clair dans data.json. Ce contrôle reste local au navigateur : la vraie barrière d'écriture
      est le jeton GitHub et la protection de la branche main. */
(function (root) {
  'use strict';

  var PERMISES = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1, SMALL: 1, SUP: 1, SUB: 1, P: 1, UL: 1, OL: 1, LI: 1, A: 1, CODE: 1 };
  var SUPPRIMEES = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TEMPLATE: 1, NOSCRIPT: 1, LINK: 1, META: 1, BASE: 1, FORM: 1, TEXTAREA: 1, SELECT: 1, FRAME: 1, FRAMESET: 1, AUDIO: 1, VIDEO: 1, IMG: 1, INPUT: 1, BUTTON: 1 };
  var CLES_INTERDITES = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  var LIEN_SUR = /^(https?:\/\/|mailto:|#)/i;
  var parseur = null;

  function nettoyerNoeud(n) {
    var enfants = Array.prototype.slice.call(n.childNodes);
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      if (e.nodeType === 3) continue;
      if (e.nodeType !== 1) { n.removeChild(e); continue; }
      var nom = e.nodeName.toUpperCase();
      if (SUPPRIMEES[nom]) { n.removeChild(e); continue; }
      nettoyerNoeud(e);
      if (!PERMISES[nom]) {
        while (e.firstChild) n.insertBefore(e.firstChild, e);
        n.removeChild(e);
        continue;
      }
      var attrs = Array.prototype.slice.call(e.attributes);
      for (var j = 0; j < attrs.length; j++) {
        var a = attrs[j].name.toLowerCase(), v = attrs[j].value;
        if (a === 'class' && /^[\w \-]*$/.test(v)) continue;
        if (a === 'href' && nom === 'A' && LIEN_SUR.test(v.trim())) continue;
        e.removeAttribute(attrs[j].name);
      }
      if (nom === 'A') { e.setAttribute('rel', 'noopener noreferrer'); e.setAttribute('target', '_blank'); }
    }
  }

  /* Une chaîne sans chevron ne peut pas ouvrir de balise. Elle peut toutefois sortir d'un attribut si le code
     l'y place sans l'échapper : les gestionnaires d'événements et les URL javascript: sont donc neutralisés. */
  function chaine(s) {
    if (s.indexOf('<') > -1) {
      try {
        parseur = parseur || new DOMParser();
        var doc = parseur.parseFromString('<!DOCTYPE html><body>' + s, 'text/html');
        nettoyerNoeud(doc.body);
        s = doc.body.innerHTML;
      } catch (e) {
        s = s.replace(/</g, '&lt;');
      }
    }
    if (/on[a-z]{3,}\s*=|javascript\s*:|data\s*:\s*text\/html/i.test(s)) {
      s = s.replace(/\bon([a-z]{3,})\s*=/gi, 'on$1&#61;').replace(/javascript\s*:/gi, 'javascript&#58;').replace(/data\s*:\s*text\/html/gi, 'data&#58;text/html');
    }
    return s;
  }

  /* Assainit un objet sur place, pour ne pas rompre les références que d'autres modules en gardent. */
  function assainir(o, prof) {
    prof = prof || 0;
    if (prof > 40 || o == null) return o;
    if (typeof o === 'string') return chaine(o);
    if (typeof o !== 'object') return o;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) {
        var v = o[i];
        if (typeof v === 'string') { if (v.length > 2) o[i] = chaine(v); }
        else if (v && typeof v === 'object') assainir(v, prof + 1);
      }
      return o;
    }
    var cles = Object.keys(o);
    for (var k = 0; k < cles.length; k++) {
      var c = cles[k];
      if (CLES_INTERDITES[c]) { delete o[c]; continue; }
      var w = o[c];
      if (typeof w === 'string') { if (w.length > 2) o[c] = chaine(w); }
      else if (w && typeof w === 'object') assainir(w, prof + 1);
    }
    return o;
  }

  /* Tout JSON lu sur le même site (data.json, data/...) est assaini dès sa lecture. */
  try {
    if (root.Response && Response.prototype && Response.prototype.json) {
      var json0 = Response.prototype.json;
      Response.prototype.json = function () {
        var meme = true;
        try { meme = !this.url || new URL(this.url, location.href).origin === location.origin; } catch (e) {}
        var p = json0.apply(this, arguments);
        return meme ? p.then(function (d) { return assainir(d); }) : p;
      };
    }
  } catch (e) {}

  /* Un data.json importé à la main doit avoir la forme attendue et une taille raisonnable. */
  function validerImport(texte) {
    if (typeof texte !== 'string' || texte.length > 8 * 1024 * 1024) throw new Error('Fichier trop volumineux.');
    var d = JSON.parse(texte);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Structure inattendue.');
    if (!d.meta || typeof d.meta !== 'object' || !Array.isArray(d.sectors) || !Array.isArray(d.municipalities)) throw new Error('Ce fichier n\'est pas un data.json du tableau de bord.');
    return assainir(d);
  }

  /* ── Mot de passe du mode « Modifier les données » : empreinte PBKDF2-SHA-256 salée ── */
  var ITER = 310000;
  function b64(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function deb64(s) { var x = atob(s), b = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i); return b; }
  function deriver(mdp, sel, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(mdp), 'PBKDF2', false, ['deriveBits']).then(function (cle) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: iter }, cle, 256);
    });
  }
  function hacher(mdp) {
    var sel = crypto.getRandomValues(new Uint8Array(16));
    return deriver(mdp, sel, ITER).then(function (h) { return { algo: 'PBKDF2-SHA-256', iter: ITER, sel: b64(sel), hash: b64(h) }; });
  }
  function egal(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
  function verifier(mdp, rec) {
    if (!rec || !rec.sel || !rec.hash || !(rec.iter >= 100000)) return Promise.resolve(false);
    return deriver(mdp, deb64(rec.sel), rec.iter).then(function (h) { return egal(b64(h), rec.hash); }).catch(function () { return false; });
  }
  /* Données plus anciennes (stockage local, ancien export) : le mot de passe en clair est converti puis effacé. */
  function migrer(meta) {
    if (!meta || typeof meta.password !== 'string') return Promise.resolve(false);
    var clair = meta.password;
    delete meta.password;
    if (!clair || meta.passwordHash) return Promise.resolve(true);
    return hacher(clair).then(function (h) { meta.passwordHash = h; return true; });
  }

  /* Trois essais ratés imposent une attente croissante, pour décourager les essais en série à l'écran. */
  var rates = 0, bloqueJusqua = 0;
  function attente() { return Math.max(0, Math.ceil((bloqueJusqua - Date.now()) / 1000)); }
  function noter(ok) {
    if (ok) { rates = 0; bloqueJusqua = 0; return; }
    rates++;
    if (rates >= 3) bloqueJusqua = Date.now() + Math.min(300, 5 * Math.pow(2, rates - 3)) * 1000;
  }

  root.GranitSecurite = { assainir: assainir, chaine: chaine, validerImport: validerImport, hacher: hacher, verifier: verifier, migrer: migrer, attente: attente, noter: noter };
})(window);
