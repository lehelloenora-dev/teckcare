/* ==========================================================================
   TECKCARE — CONFIGURATION CENTRALE
   Tout ce qui est modifiable sans toucher au code du site se trouve ici :
   prix, formats, formule de ration, identifiant Google Analytics, test A/B…
   Les valeurs marquées « À VALIDER » ou « FICTIF » sont des hypothèses de
   démonstration : elles ne proviennent d'aucun document validé du projet.
   ========================================================================== */
window.TECKCARE_CONFIG = {

  /* ---------- Site ---------- */
  site: {
    name: "TeckCare",
    // À COMPLÉTER : l'adresse publique du site (sert aux balises canonical / OG / sitemap)
    url: "https://lehelloenora-dev.github.io/teckcare/",
    contactEmail: "",   // aucune adresse de contact opérationnelle pour ce prototype
    currency: "EUR"
  },

  /* ---------- Mesure (Google Analytics 4) ----------
     measurementId : collez votre identifiant « G-XXXXXXXXXX ».
       • Vide  → AUCUN envoi à GA4. Les événements sont seulement journalisés
                 en local (panneau de debug, ouvrir le site avec ?debug=1).
       • Rempli → un bandeau de consentement apparaît ; GA4 ne se charge
                 qu'après « Accepter ».
     debugMode : true force le panneau de debug et le mode DebugView de GA4. */
  analytics: {
    measurementId: "",      // ex. "G-AB12CD34EF"
    debugMode: false,
    activationTarget: 0.30  // hypothèse : 30 % d'activation
  },

  /* ---------- Test A/B : UNE SEULE variable testée à la fois ----------
     active : identifiant de l'expérience en cours (ou "" pour couper le test).
     Chaque expérience ne modifie qu'UN élément repéré dans le HTML par
     data-exp="<identifiant>". Forcer une variante pour vérifier : ?ab=B     */
  experiments: {
    active: null, /* test du libellé terminé : le bouton affiche « Préparer sa gamelle » */
    definitions: {
      hero_cta_label: {
        description: "Libellé du bouton du champ prénom (hero)",
        variants: {
          A: { weight: 50, text: "Préparer sa gamelle" },
          B: { weight: 50, text: "Préparer sa gamelle" }
        }
      }
    }
  },

  /* ---------- Produit ----------
     FICTIF : formats et prix à remplacer par les données validées.      */
  product: {
    id: "poulet-saumon",
    name: "TeckCare Poulet & Saumon",
    shortName: "Poulet & Saumon",
    dataIsDemo: true,
    formats: [
      { id: "poulet-saumon-2kg", label: "2 kg", kg: 2, price: 16.90, hint: "Pour démarrer" },
      { id: "poulet-saumon-5kg", label: "5 kg", kg: 5, price: 36.90, hint: "Le plus avantageux au kilo" }
    ]
  },

  /* ---------- Pâtées en vente (prix À VALIDER par l'équipe) ---------- */
  extras: [
    { id: "pate-nomade-100g", name: "Pâtée nomade Poulet & Saumon", label: "100 g", price: 2.90, img: "assets/pack/photo/pouch-front.webp" },
    { id: "pate-gourmande-80g", name: "Pâtée gourmande Poulet & Saumon", label: "80 g", price: 2.40, img: "assets/pack/photo/tray-front.webp" }
  ],

  /* ---------- Pâtées (À VALIDER avec la fiche produit) ----------
     kcalPer100g : énergie de travail pour retirer l'équivalent en croquettes. */
  pates: { gourmande: { label: "Pâtée gourmande", grams: 80, kcalPer100g: 100 }, nomade: { label: "Pâtée nomade", grams: 100, kcalPer100g: 100 } },

  /* ---------- Livraison ---------- */
  shipping: { fee: 3.90, freeFrom: 39, label: "Livraison" },   // offerte dès 39 € de produits après réduction

  /* ---------- Balades du club (exemples de dates futures, organisées par TeckCare) ---------- */
  walks: [
    { id: "paris-2026-11-21", city: "Paris", place: "Parc Montsouris, entrée avenue Reille", date: "2026-11-21", time: "10:00", duration: "1 h", places: 12 },
    { id: "lyon-2026-11-29", city: "Lyon", place: "Parc de la Tête d’Or, entrée des Enfants du Rhône", date: "2026-11-29", time: "10:30", duration: "1 h", places: 10 },
    { id: "bordeaux-2026-12-05", city: "Bordeaux", place: "Jardin public, entrée cours de Verdun", date: "2026-12-05", time: "10:00", duration: "1 h", places: 10 },
    { id: "nantes-2026-12-12", city: "Nantes", place: "Jardin des plantes, entrée boulevard de Stalingrad", date: "2026-12-12", time: "14:30", duration: "1 h", places: 8 }
  ],

  /* ---------- Parrainage ---------- */
  referral: { discount: 0.20, rewardAfter: 3, rewardFormat: "poulet-saumon-2kg" },

  /* ---------- Formule de ration — ESTIMATION CONFIGURABLE (À VALIDER) ----------
     Méthode : besoin énergétique = coef × poids^exposant (« RER »)
               × facteur de croissance selon l'âge × ajustement silhouette.
     Ration (g/jour) = besoin (kcal) ÷ densité énergétique (kcal/kg) × 1000.
     ⚠ Les facteurs par âge et la densité énergétique sont des valeurs courantes
       de la littérature vétérinaire, retenues ici comme hypothèses de travail.
       Remplacez-les par la table d'alimentation de la fiche produit définitive. */
  ration: {
    kcalPerKg: 3800,                      // À VALIDER : énergie métabolisable des croquettes
    rer: { coef: 70, exponent: 0.75 },
    factorsByAge: [                       // À VALIDER : facteur de croissance + nb de repas
      { from: 2,  to: 3,  factor: 3.0, meals: 4 },
      { from: 4,  to: 5,  factor: 2.5, meals: 3 },
      { from: 6,  to: 8,  factor: 2.0, meals: 3 },
      { from: 9,  to: 12, factor: 1.8, meals: 2 }
    ],
    silhouette: {                         // ajustement selon la silhouette observée
      mince:  { label: "Plutôt mince", multiplier: 1.10 },
      ideale: { label: "Idéale",       multiplier: 1.00 },
      ronde:  { label: "Un peu ronde", multiplier: 0.90 }
    },
    ageRange:    { min: 2,   max: 12 },
    weightRange: { min: 0.5, max: 15 },   // bornes de saisie valides (kg)
    weightSoftWarnAbove: 12,              // avertissement doux, sans bloquer
    targetBagDays: 30                     // durée de sac visée pour la recommandation
  },

  /* ---------- Exemples de rations affichés sur l'accueil (calculés avec la formule ci-dessus) ----------
     Ce sont des profils illustratifs, pas des statistiques : modifiez-les librement. */
  examples: [
    { age: 3,  weight: 2.0, shape: "ideale", title: "Un petit de 3 mois" },
    { age: 6,  weight: 4.0, shape: "ideale", title: "Un ado de 6 mois" },
    { age: 10, weight: 6.0, shape: "ideale", title: "Bientôt adulte, 10 mois" }
  ],

  /* ---------- Rappel de fin de sac ---------- */
  reminder: {
    daysBefore: 5,        // rappel 5 jours avant la fin estimée
    // OPTIONNEL : URL d'un service de formulaire (Formspree, Brevo, etc.).
    // Vide = la demande est enregistrée localement seulement (mode démo).
    endpoint: ""
  },

  /* ---------- Composition (FICTIF — NE PAS PUBLIER TELLE QUELLE) ---------- */
  composition: {
    verified: false,
    items: [
      { label: "Ingrédients principaux", value: "À compléter avec la fiche produit définitive" },
      { label: "Analyse nutritionnelle", value: "À compléter (protéines, matières grasses, cendres, fibres…)" },
      { label: "Énergie métabolisable", value: "3 800 kcal/kg — valeur de travail à valider" },
      { label: "Origine des ingrédients", value: "À compléter" }
    ]
  },

  /* ---------- Sources déclarées à la commande ---------- */
  acquisitionSources: [
    { id: "instagram",      label: "Instagram" },
    { id: "tiktok",         label: "TikTok" },
    { id: "google",         label: "Google" },
    { id: "recommandation", label: "Recommandation" },
    { id: "autre",          label: "Autre" }
  ]
};
