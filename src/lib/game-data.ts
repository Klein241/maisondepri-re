/**
 * GAME DATA SERVICE - Unlimited Bible Games
 * ==========================================
 * Provides static data for games to work without external Bible API dependencies.
 * Games can use this data when Bible is not available.
 * 
 * EXPANDED CONTENT: Over 300 questions/items added for "Pro" experience.
 */

// Extensive list of Bible questions for Quiz
export const BIBLE_QUESTIONS = [
    // --- EASY QUESTIONS (GENESIS to REVELATION) ---
    { question: "Qui a créé le monde selon la Bible?", options: ["Dieu", "Moïse", "Abraham", "Jésus"], answer: 0, difficulty: "easy" },
    { question: "Combien de jours Dieu a-t-il utilisé pour créer le monde?", options: ["6", "7", "5", "3"], answer: 0, difficulty: "easy" },
    { question: "Quel est le premier livre de la Bible?", options: ["Genèse", "Exode", "Matthieu", "Apocalypse"], answer: 0, difficulty: "easy" },
    { question: "Qui a construit l'arche?", options: ["Noé", "Abraham", "Moïse", "David"], answer: 0, difficulty: "easy" },
    { question: "Combien d'apôtres Jésus avait-il?", options: ["12", "10", "7", "3"], answer: 0, difficulty: "easy" },
    { question: "Dans quelle ville Jésus est-il né?", options: ["Bethléem", "Jérusalem", "Nazareth", "Capernaüm"], answer: 0, difficulty: "easy" },
    { question: "Qui a trahi Jésus?", options: ["Judas", "Pierre", "Jean", "Thomas"], answer: 0, difficulty: "easy" },
    { question: "Combien de livres y a-t-il dans la Bible?", options: ["66", "72", "50", "100"], answer: 0, difficulty: "easy" },
    { question: "Qui était le premier homme?", options: ["Adam", "Noé", "Abraham", "Moïse"], answer: 0, difficulty: "easy" },
    { question: "Qui était la première femme?", options: ["Ève", "Marie", "Sarah", "Ruth"], answer: 0, difficulty: "easy" },
    { question: "Quelle mer Moïse a-t-il traversée?", options: ["Mer Rouge", "Mer Morte", "Mer Méditerranée", "Jourdain"], answer: 0, difficulty: "easy" },
    { question: "Qui a tué Goliath?", options: ["David", "Saül", "Jonathan", "Samuel"], answer: 0, difficulty: "easy" },
    { question: "Quel fruit était interdit dans le jardin d'Éden?", options: ["Fruit de l'arbre de la connaissance", "Pomme", "Raisin", "Figue"], answer: 0, difficulty: "easy" },
    { question: "Qui a été avalé par un grand poisson?", options: ["Jonas", "Élie", "Élisée", "Daniel"], answer: 0, difficulty: "easy" },
    { question: "Combien de plaies d'Égypte y a-t-il eu?", options: ["10", "7", "12", "5"], answer: 0, difficulty: "easy" },
    { question: "Quel est le signe de l'alliance de Dieu avec Noé?", options: ["L'arc-en-ciel", "La circoncision", "La Pâque", "Le Sabbat"], answer: 0, difficulty: "easy" },
    { question: "Qui a reçu les 10 commandements?", options: ["Moïse", "Aaron", "Josué", "Caleb"], answer: 0, difficulty: "easy" },
    { question: "Qui était le frère d'Abel?", options: ["Caïn", "Seth", "Adam", "Noé"], answer: 0, difficulty: "easy" },
    { question: "Quel animal a parlé à Balaam?", options: ["Une ânesse", "Un lion", "Un serpent", "Un aigle"], answer: 0, difficulty: "easy" },
    { question: "Qui a été jeté dans la fosse aux lions?", options: ["Daniel", "David", "Samson", "Gédéon"], answer: 0, difficulty: "easy" },
    { question: "Quel est le dernier livre de la Bible?", options: ["Apocalypse", "Actes", "Jude", "Malachie"], answer: 0, difficulty: "easy" },
    { question: "Qui a marché sur l'eau avec Jésus?", options: ["Pierre", "Jean", "Jacques", "André"], answer: 0, difficulty: "easy" },
    { question: "De quelle ville Paul était-il originaire?", options: ["Tarse", "Rome", "Jérusalem", "Antioche"], answer: 0, difficulty: "easy" },
    { question: "Qui a baptisé Jésus?", options: ["Jean-Baptiste", "Pierre", "Paul", "Philippe"], answer: 0, difficulty: "easy" },
    { question: "Combien de temps a duré le déluge?", options: ["40 jours et 40 nuits", "7 jours", "150 jours", "1 an"], answer: 0, difficulty: "easy" },
    { question: "Quel roi d'Israël était connu pour sa sagesse?", options: ["Salomon", "David", "Saül", "Josias"], answer: 0, difficulty: "easy" },
    { question: "Qui a vendu son droit d'aînesse pour un plat de lentilles?", options: ["Ésaü", "Jacob", "Isaac", "Joseph"], answer: 0, difficulty: "easy" },
    { question: "Qui a été transformée en statue de sel?", options: ["La femme de Lot", "La femme de Noé", "Sarah", "Rébecca"], answer: 0, difficulty: "easy" },
    { question: "Quel géant avait six doigts à chaque main et à chaque pied?", options: ["Un descendant de Rapha", "Goliath", "Og", "Anak"], answer: 0, difficulty: "easy" },
    { question: "Qui a écrit la plupart des Psaumes?", options: ["David", "Salomon", "Moïse", "Asaph"], answer: 0, difficulty: "easy" },
    { question: "Qui a ressuscité d'entre les morts après trois jours?", options: ["Jésus", "Lazare", "Moïse", "Élie"], answer: 0, difficulty: "easy" },
    { question: "Comment s'appelait la mère de Samuel?", options: ["Anne", "Penne", "Ruth", "Naomi"], answer: 0, difficulty: "easy" },
    { question: "Qui était le premier roi d'Israël?", options: ["Saül", "David", "Salomon", "Samuel"], answer: 0, difficulty: "easy" },
    { question: "Quel apôtre était médecin?", options: ["Luc", "Paul", "Pierre", "Matthieu"], answer: 0, difficulty: "easy" },
    { question: "Qui a nié connaître Jésus trois fois?", options: ["Pierre", "Judas", "Thomas", "Jean"], answer: 0, difficulty: "easy" },
    { question: "Quel était le métier de Joseph, père adoptif de Jésus?", options: ["Charpentier", "Pêcheur", "Berger", "Collecteur d'impôts"], answer: 0, difficulty: "easy" },
    { question: "Où Adam et Ève vivaient-ils au début?", options: ["Jardin d'Éden", "Canaan", "Égypte", "Jéricho"], answer: 0, difficulty: "easy" },
    { question: "Qui a combattu les prophètes de Baal au mont Carmel?", options: ["Élie", "Élisée", "Samuel", "Nathan"], answer: 0, difficulty: "easy" },
    { question: "Qui était la reine qui a sauvé les Juifs?", options: ["Esther", "Ruth", "Débora", "Jézabel"], answer: 0, difficulty: "easy" },
    { question: "Qui a été emporté au ciel sans mourir?", options: ["Énoch", "Noé", "Abraham", "Isaac"], answer: 0, difficulty: "easy" }, // Elijah also, but Enoch fits too

    // --- MEDIUM QUESTIONS ---
    { question: "Quel roi a bâti le premier temple de Jérusalem?", options: ["Salomon", "David", "Saül", "Roboam"], answer: 0, difficulty: "medium" },
    { question: "Combien de fils Jacob avait-il?", options: ["12", "10", "7", "13"], answer: 0, difficulty: "medium" },
    { question: "Qui était le père de Jean-Baptiste?", options: ["Zacharie", "Joseph", "Élisée", "Siméon"], answer: 0, difficulty: "medium" },
    { question: "Quelle est la plus longue épître de Paul?", options: ["Romains", "1 Corinthiens", "Hébreux", "Galates"], answer: 0, difficulty: "medium" },
    { question: "Combien de temps Jésus a-t-il jeûné dans le désert?", options: ["40 jours", "30 jours", "7 jours", "21 jours"], answer: 0, difficulty: "medium" },
    { question: "Qui a demandé la tête de Jean-Baptiste?", options: ["Hérodiade", "Salomé", "Hérode", "Pilate"], answer: 0, difficulty: "medium" },
    { question: "Quel prophète a été enlevé au ciel dans un char de feu?", options: ["Élie", "Énoch", "Élisée", "Moïse"], answer: 0, difficulty: "medium" },
    { question: "Qui a renié Jésus trois fois?", options: ["Pierre", "Judas", "Thomas", "Jacques"], answer: 0, difficulty: "medium" },
    { question: "Combien de personnes Jésus a-t-il nourries avec 5 pains et 2 poissons?", options: ["5000", "4000", "3000", "7000"], answer: 0, difficulty: "medium" },
    { question: "Quelle ville Josué a-t-il conquise en premier?", options: ["Jéricho", "Aï", "Hébron", "Sichem"], answer: 0, difficulty: "medium" },
    { question: "Qui était le frère de Moïse?", options: ["Aaron", "Lévi", "Myriam", "Josué"], answer: 0, difficulty: "medium" },
    { question: "Quel ange a annoncé la naissance de Jésus à Marie?", options: ["Gabriel", "Michel", "Raphaël", "Uriel"], answer: 0, difficulty: "medium" },
    { question: "De quoi étaient faits les dix commandements?", options: ["Pierre", "Bois", "Or", "Argile"], answer: 0, difficulty: "medium" },
    { question: "Qui a interprété les rêves de Pharaon?", options: ["Joseph", "Daniel", "Moïse", "Abraham"], answer: 0, difficulty: "medium" },
    { question: "Quel roi a eu la sagesse de Dieu?", options: ["Salomon", "David", "Saül", "Ézéchias"], answer: 0, difficulty: "medium" },
    { question: "Qui a remplacé Judas parmi les douze apôtres?", options: ["Matthias", "Paul", "Barnabas", "Silas"], answer: 0, difficulty: "medium" },
    { question: "Quel prophéte a oint David comme roi?", options: ["Samuel", "Nathan", "Élie", "Élisée"], answer: 0, difficulty: "medium" },
    { question: "Quelle fête commémore la sortie d'Égypte?", options: ["La Pâque", "La Pentecôte", "La Fête des Tabernacles", "Le Yom Kippour"], answer: 0, difficulty: "medium" },
    { question: "De quelle tribu Jésus est-il issu?", options: ["Juda", "Lévi", "Benjamin", "Dan"], answer: 0, difficulty: "medium" },
    { question: "Qui a écrit l'Apocalypse?", options: ["Jean", "Pierre", "Paul", "Jacques"], answer: 0, difficulty: "medium" },
    { question: "Où Jésus a-t-il transformé l'eau en vin?", options: ["Cana", "Nazareth", "Capernaüm", "Béthanie"], answer: 0, difficulty: "medium" },
    { question: "Qui a aidé Jésus à porter sa croix?", options: ["Simon de Cyrène", "Joseph d'Arimathée", "Nicodème", "Jean"], answer: 0, difficulty: "medium" },
    { question: "Quel roi a déporté les Juifs à Babylone?", options: ["Nebucadnetsar", "Cyrus", "Darius", "Sennachérib"], answer: 0, difficulty: "medium" },
    { question: "Qui était la belle-mère de Ruth?", options: ["Naomi", "Orpa", "Mara", "Hannah"], answer: 0, difficulty: "medium" },
    { question: "Qui a tué Sisera avec un piquet de tente?", options: ["Jaël", "Débora", "Baraq", "Abigaïl"], answer: 0, difficulty: "medium" },
    { question: "Qui était le père de Matusalem?", options: ["Énoch", "Lémec", "Noé", "Jared"], answer: 0, difficulty: "medium" },
    { question: "Quel est le verset le plus court de l'Ancien Testament (en hébreu)?", options: ["1 Chroniques 1:25", "Exode 20:13", "Job 3:2", "Genèse 1:1"], answer: 0, difficulty: "medium" },
    { question: "Qui a vu l'échelle reliant la terre au ciel?", options: ["Jacob", "Abraham", "Isaac", "Joseph"], answer: 0, difficulty: "medium" },
    { question: "Qui a caché les espions à Jéricho?", options: ["Rahab", "Ruth", "Esther", "Sarah"], answer: 0, difficulty: "medium" },
    { question: "Quel animal Samson a-t-il tué à mains nues?", options: ["Un lion", "Un ours", "Un loup", "Un sanglier"], answer: 0, difficulty: "medium" },
    { question: "Qui était le premier martyr chrétien?", options: ["Étienne", "Jacques", "Pierre", "Paul"], answer: 0, difficulty: "medium" },
    { question: "Combien de lettres Jean a-t-il écrites?", options: ["3", "2", "1", "4"], answer: 0, difficulty: "medium" },
    { question: "Où se sont convertis les premiers païens?", options: ["Maison de Corneille", "Maison de Lydie", "Synagogue d'Antioche", "Prison de Philippes"], answer: 0, difficulty: "medium" },
    { question: "Qui était le roi de Perse qui a permis la reconstruction du temple?", options: ["Cyrus", "Darius", "Artaxerxés", "Assuérus"], answer: 0, difficulty: "medium" },
    { question: "Quel prophète a épousé une prostituée sur ordre de Dieu?", options: ["Osée", "Amos", "Michée", "Joël"], answer: 0, difficulty: "medium" },

    // --- HARD QUESTIONS ---
    { question: "Quel est le verset le plus court de la Bible?", options: ["Jésus pleura", "Priez sans cesse", "Aimez-vous", "Soyez saints"], answer: 0, difficulty: "hard" },
    { question: "Combien de livres l'apôtre Paul a-t-il écrits?", options: ["13", "14", "10", "7"], answer: 0, difficulty: "hard" },
    { question: "Qui était Melchisédek?", options: ["Roi et sacrificateur", "Prophète", "Ange", "Juge"], answer: 0, difficulty: "hard" },
    { question: "Quel patriarche a vécu le plus longtemps?", options: ["Mathusalem", "Adam", "Noé", "Seth"], answer: 0, difficulty: "hard" },
    { question: "Quelle est la 'Grande Commission'?", options: ["Faire des disciples", "Construire le temple", "Jeûner 40 jours", "Vaincre les géants"], answer: 0, difficulty: "hard" },
    { question: "Qui était Barnabas?", options: ["Compagnon de Paul", "Apôtre de Jésus", "Prophète", "Ange"], answer: 0, difficulty: "hard" },
    { question: "Combien de fois le mot 'amour' apparaît-il dans 1 Corinthiens 13?", options: ["9 fois", "7 fois", "12 fois", "5 fois"], answer: 0, difficulty: "hard" },
    { question: "Quel livre de la Bible ne mentionne pas Dieu?", options: ["Esther", "Ruth", "Jonas", "Amos"], answer: 0, difficulty: "hard" },
    { question: "Qui a écrit le livre des Proverbes?", options: ["Salomon principalement", "David", "Moïse", "Samuel"], answer: 0, difficulty: "hard" },
    { question: "Quel était le métier de Lydie dans Actes 16?", options: ["Marchande de pourpre", "Couturière", "Potière", "Tisserande"], answer: 0, difficulty: "hard" },
    { question: "Combien d'années les Israélites ont-ils erré dans le désert?", options: ["40 ans", "50 ans", "30 ans", "25 ans"], answer: 0, difficulty: "hard" },
    { question: "Quel prophète a mangé un rouleau?", options: ["Ézéchiel", "Jérémie", "Ésaïe", "Daniel"], answer: 0, difficulty: "hard" },
    { question: "Qui a été le dernier juge d'Israël?", options: ["Samuel", "Samson", "Éli", "Gédéon"], answer: 0, difficulty: "hard" },
    { question: "Quelle est la signification du nom Emmanuel?", options: ["Dieu avec nous", "Dieu sauve", "Dieu est grand", "Dieu écoute"], answer: 0, difficulty: "hard" },
    { question: "Combien de lettres Jean a-t-il écrites?", options: ["3", "2", "4", "1"], answer: 0, difficulty: "hard" },
    { question: "Qui était le père de Caleb?", options: ["Jephunné", "Nun", "Hezron", "Pérets"], answer: 0, difficulty: "hard" },
    { question: "Quel est le nom de la montagne où l'arche de Noé s'est arrêtée?", options: ["Ararat", "Sinaï", "Sion", "Nébo"], answer: 0, difficulty: "hard" },
    { question: "Combien de sources d'eau y avait-il à Élim?", options: ["12", "7", "70", "40"], answer: 0, difficulty: "hard" },
    { question: "Qui a tué Eglon, roi de Moab?", options: ["Éhud", "Samson", "Gédéon", "Barak"], answer: 0, difficulty: "hard" },
    { question: "Qui a prophétisé sur la vallée des ossements desséchés?", options: ["Ézéchiel", "Daniel", "Jérémie", "Ésaïe"], answer: 0, difficulty: "hard" },
    { question: "Quel roi a brûlé le rouleau de Jérémie?", options: ["Jojakim", "Sédécias", "Jéchonias", "Josias"], answer: 0, difficulty: "hard" },
    { question: "Qui a été guéri de la lèpre en se lavant 7 fois dans le Jourdain?", options: ["Naaman", "Guéhazi", "Jéroboam", "Achab"], answer: 0, difficulty: "hard" },
    { question: "Quel est le plus long Psaume?", options: ["119", "23", "1", "150"], answer: 0, difficulty: "hard" },
    { question: "Qui a régné seulement 7 jours en Israël?", options: ["Zimri", "Omri", "Éla", "Nadab"], answer: 0, difficulty: "hard" },
    { question: "Quel apôtre a remplacé Judas?", options: ["Matthias", "Barnabas", "Silas", "Timothée"], answer: 0, difficulty: "hard" },
    { question: "Qui a dit 'Si je péris, je péris'?", options: ["Esther", "Ruth", "Débora", "Marie"], answer: 0, difficulty: "hard" },
    { question: "Quel est le nom hébreu de Pierre?", options: ["Cephas", "Simon", "André", "Jean"], answer: 0, difficulty: "hard" },
    { question: "Qui était la femme de Félix le gouverneur?", options: ["Drusille", "Bérénice", "Hérodiade", "Salomé"], answer: 0, difficulty: "hard" },
    { question: "Quel prophète a été nourri par des corbeaux?", options: ["Élie", "Élisée", "Jérémie", "Ésaïe"], answer: 0, difficulty: "hard" },
    { question: "Combien de fois Paul a-t-il fait naufrage?", options: ["3 fois", "1 fois", "2 fois", "4 fois"], answer: 0, difficulty: "hard" },
    { question: "Qui est tombé d'une fenêtre pendant que Paul prêchait?", options: ["Eutychus", "Tychique", "Trophime", "Aristarque"], answer: 0, difficulty: "hard" },
    { question: "Quel est le nom de la porte du temple appelée 'La Belle'?", options: ["La Belle", "La Dorée", "L'Orientale", "La Sainte"], answer: 0, difficulty: "hard" },
    { question: "Qui a offert la dîme à Melchisédek?", options: ["Abraham", "Isaac", "Jacob", "Lot"], answer: 0, difficulty: "hard" },
    { question: "Combien de guerriers Gédéon a-t-il gardés?", options: ["300", "3000", "1000", "100"], answer: 0, difficulty: "hard" },
    { question: "Quel prophète avait une vision de quatre êtres vivants?", options: ["Ézéchiel", "Daniel", "Zacharie", "Habacuc"], answer: 0, difficulty: "hard" },
    { question: "Qui a construit la muraille de Jérusalem en 52 jours?", options: ["Néhémie", "Esdras", "Zorobabel", "Josué"], answer: 0, difficulty: "hard" },

    // --- BONUS EASY QUESTIONS ---
    { question: "Quel jour de la semaine Dieu s'est-il reposé?", options: ["Le 7ème jour", "Le 6ème jour", "Le 1er jour", "Le 5ème jour"], answer: 0, difficulty: "easy" },
    { question: "Qui a dit 'Que la lumière soit'?", options: ["Dieu", "Moïse", "Jésus", "Abraham"], answer: 0, difficulty: "easy" },
    { question: "Combien de frères Joseph avait-il?", options: ["11", "12", "10", "7"], answer: 0, difficulty: "easy" },
    { question: "Quelle était la profession de Pierre avant de suivre Jésus?", options: ["Pêcheur", "Charpentier", "Berger", "Collecteur d'impôts"], answer: 0, difficulty: "easy" },
    { question: "Qui a donné son nom aux cinq premiers livres de la Bible?", options: ["Moïse", "David", "Salomon", "Abraham"], answer: 0, difficulty: "easy" },
    { question: "Quelle nourriture Dieu a envoyée du ciel aux Israélites?", options: ["La manne", "Du pain", "Des figues", "Du miel"], answer: 0, difficulty: "easy" },
    { question: "Combien de fois Jésus a-t-il tenté par le diable dans le désert?", options: ["3", "7", "1", "40"], answer: 0, difficulty: "easy" },
    { question: "Quel disciple a douté de la résurrection de Jésus?", options: ["Thomas", "Pierre", "Jean", "Jacques"], answer: 0, difficulty: "easy" },
    { question: "Qui a écrit la majorité de l'Ancien Testament en termes de livres?", options: ["Moïse", "David", "Salomon", "Ésaïe"], answer: 0, difficulty: "easy" },
    { question: "De quelle couleur était la tunique de Joseph?", options: ["Multicolore", "Blanche", "Pourpre", "Rouge"], answer: 0, difficulty: "easy" },

    // --- BONUS MEDIUM QUESTIONS ---
    { question: "Quelle parabole parle d'un fils qui part et revient?", options: ["Le fils prodigue", "Le bon samaritain", "Les talents", "Le semeur"], answer: 0, difficulty: "medium" },
    { question: "Combien de pains Jésus a multipliés pour nourrir 4000 personnes?", options: ["7", "5", "3", "12"], answer: 0, difficulty: "medium" },
    { question: "Qui a dit 'N'aie pas peur, crois seulement'?", options: ["Jésus", "Paul", "Pierre", "Moïse"], answer: 0, difficulty: "medium" },
    { question: "Quel miracle Jésus a fait en premier selon Jean?", options: ["Changé l'eau en vin", "Guéri un aveugle", "Nourri 5000 personnes", "Marché sur l'eau"], answer: 0, difficulty: "medium" },
    { question: "Combien de tribus d'Israël y avait-il?", options: ["12", "10", "7", "13"], answer: 0, difficulty: "medium" },
    { question: "Quel roi a tué Jean-Baptiste?", options: ["Hérode Antipas", "Hérode le Grand", "Auguste", "Pilate"], answer: 0, difficulty: "medium" },
    { question: "Où Paul a-t-il été converti?", options: ["Sur le chemin de Damas", "À Jérusalem", "À Tarse", "À Rome"], answer: 0, difficulty: "medium" },
    { question: "Quel prophète a été appelé le 'prophète pleureur'?", options: ["Jérémie", "Ésaïe", "Ézéchiel", "Daniel"], answer: 0, difficulty: "medium" },
    { question: "Combien d'épîtres l'apôtre Jean a-t-il écrites?", options: ["3", "2", "1", "5"], answer: 0, difficulty: "medium" },
    { question: "Quelle femme a été la première convertie en Europe?", options: ["Lydie", "Priscille", "Phoebe", "Dorcas"], answer: 0, difficulty: "medium" },
    { question: "Quel arbre Zachée a-t-il escaladé?", options: ["Sycomore", "Olivier", "Figuier", "Palmier"], answer: 0, difficulty: "medium" },
    { question: "Quelle montagne Moïse a-t-il gravi pour voir la Terre Promise?", options: ["Mont Nébo", "Mont Sinaï", "Mont Carmel", "Mont des Oliviers"], answer: 0, difficulty: "medium" },
    { question: "Quel est l'autre nom de l'apôtre Paul?", options: ["Saul", "Silas", "Silvain", "Simon"], answer: 0, difficulty: "medium" },
    { question: "Qui était le gouverneur romain lors du procès de Jésus?", options: ["Ponce Pilate", "César Auguste", "Hérode", "Félix"], answer: 0, difficulty: "medium" },
    { question: "Quel fleuve traverse le pays d'Israël?", options: ["Le Jourdain", "Le Nil", "L'Euphrate", "Le Tigre"], answer: 0, difficulty: "medium" },
    { question: "Combien de livres y a-t-il dans le Nouveau Testament?", options: ["27", "39", "22", "30"], answer: 0, difficulty: "medium" },
    { question: "Quel jour commémore-t-on la résurrection de Jésus?", options: ["Pâques", "Noël", "Pentecôte", "Ascension"], answer: 0, difficulty: "medium" },
    { question: "Qui était le frère de Marthe et Marie?", options: ["Lazare", "Simon", "Joseph", "André"], answer: 0, difficulty: "medium" },
    { question: "Dans quelle ville Paul a-t-il prêché sur l'Aréopage?", options: ["Athènes", "Rome", "Corinthe", "Éphèse"], answer: 0, difficulty: "medium" },
    { question: "Quel livre de la Bible contient le plus de chapitres?", options: ["Psaumes", "Ésaïe", "Genèse", "Jérémie"], answer: 0, difficulty: "medium" },

    // --- BONUS HARD QUESTIONS ---
    { question: "Qui a dit 'Mon peuple périt faute de connaissance'?", options: ["Osée", "Amos", "Michée", "Joël"], answer: 0, difficulty: "hard" },
    { question: "Quel roi avait 700 femmes et 300 concubines?", options: ["Salomon", "David", "Achab", "Hérode"], answer: 0, difficulty: "hard" },
    { question: "Comment s'appelle la vallée où David a combattu Goliath?", options: ["Vallée d'Éla", "Vallée de Hinnom", "Vallée du Jourdain", "Vallée de Josaphat"], answer: 0, difficulty: "hard" },
    { question: "Quel est le plus petit livre de l'Ancien Testament?", options: ["Abdias", "Aggée", "Nahum", "Habacuc"], answer: 0, difficulty: "hard" },
    { question: "Qui a vu quatre cavaliers dans une vision?", options: ["Jean dans l'Apocalypse", "Daniel", "Ézéchiel", "Zacharie"], answer: 0, difficulty: "hard" },
    { question: "Quel roi a consulté la nécromancienne d'En-Dor?", options: ["Saül", "David", "Achab", "Jéroboam"], answer: 0, difficulty: "hard" },
    { question: "Combien de villes de refuge y avait-il en Israël?", options: ["6", "3", "7", "12"], answer: 0, difficulty: "hard" },
    { question: "Qui a prophétisé que le Messie naîtrait à Bethléem?", options: ["Michée", "Ésaïe", "Jérémie", "Zacharie"], answer: 0, difficulty: "hard" },
    { question: "Quel était le premier miracle d'Élisée?", options: ["Purifier les eaux de Jéricho", "Multiplier l'huile", "Guérir Naaman", "Ressusciter un enfant"], answer: 0, difficulty: "hard" },
    { question: "Combien de jours Goliath a-t-il défié les Israélites?", options: ["40", "7", "30", "21"], answer: 0, difficulty: "hard" },
    { question: "Qui a écrit le cantique de Moïse après la traversée de la Mer Rouge?", options: ["Myriam", "Aaron", "Moïse", "Josué"], answer: 0, difficulty: "hard" },
    { question: "Quel apôtre a eu une vision d'une nappe descendant du ciel?", options: ["Pierre", "Paul", "Jean", "Jacques"], answer: 0, difficulty: "hard" },
    { question: "Quelle église a reçu le reproche d'être 'tiède'?", options: ["Laodicée", "Sardes", "Pergame", "Thyatire"], answer: 0, difficulty: "hard" },
    { question: "Quel roi a fait creuser un tunnel pour amener l'eau dans Jérusalem?", options: ["Ézéchias", "Salomon", "Josias", "Manassé"], answer: 0, difficulty: "hard" },
    { question: "Combien d'années Jacob a-t-il travaillé pour Rachel?", options: ["14", "7", "21", "10"], answer: 0, difficulty: "hard" },
    { question: "Quel prophète a été enterré vivant dans une citerne?", options: ["Jérémie", "Ésaïe", "Ézéchiel", "Daniel"], answer: 0, difficulty: "hard" },
    { question: "Qui a dit 'L'Éternel est mon berger, je ne manquerai de rien'?", options: ["David", "Salomon", "Moïse", "Abraham"], answer: 0, difficulty: "hard" },
    { question: "Quel est le dernier mot de la Bible?", options: ["Amen", "Grâce", "Jésus", "Éternité"], answer: 0, difficulty: "hard" },
    { question: "Combien de psaumes la Bible contient-elle?", options: ["150", "120", "100", "175"], answer: 0, difficulty: "hard" },
    { question: "Qui était le beau-père de Moïse?", options: ["Jéthro", "Aaron", "Caleb", "Hobab"], answer: 0, difficulty: "hard" },
];

// Famous Bible verses for Memory Game
export const BIBLE_VERSES_PAIRS = [
    { reference: "Jean 3:16", text: "Car Dieu a tant aimé le monde" },
    { reference: "Psaume 23:1", text: "L'Éternel est mon berger" },
    { reference: "Philippiens 4:13", text: "Je puis tout par celui qui me fortifie" },
    { reference: "Romains 8:28", text: "Toutes choses concourent au bien" },
    { reference: "Proverbes 3:5", text: "Confie-toi en l'Éternel de tout ton coeur" },
    { reference: "Ésaïe 40:31", text: "Ceux qui se confient en l'Éternel renouvellent leur force" },
    { reference: "Matthieu 11:28", text: "Venez à moi, vous tous qui êtes fatigués" },
    { reference: "Josué 1:9", text: "Fortifie-toi et prends courage" },
    { reference: "Jérémie 29:11", text: "Je connais les projets que j'ai formés sur vous" },
    { reference: "Galates 5:22", text: "Le fruit de l'Esprit, c'est l'amour" },
    { reference: "Romains 6:23", text: "Le salaire du péché, c'est la mort" },
    { reference: "Hébreux 11:1", text: "La foi est une ferme assurance" },
    { reference: "1 Jean 4:8", text: "Dieu est amour" },
    { reference: "2 Timothée 1:7", text: "Dieu ne nous a pas donné un esprit de timidité" },
    { reference: "Ephésiens 2:8", text: "C'est par la grâce que vous êtes sauvés" },
    { reference: "Matthieu 28:19", text: "Allez, faites de toutes les nations des disciples" },
    { reference: "Jean 14:6", text: "Je suis le chemin, la vérité et la vie" },
    { reference: "Romains 12:2", text: "Ne vous conformez pas au siècle présent" },
    { reference: "Proverbes 18:10", text: "Le nom de l'Éternel est une tour forte" },
    { reference: "Psaume 119:105", text: "Ta parole est une lampe à mes pieds" },
    // ADDITIONAL VERSES
    { reference: "Genèse 1:1", text: "Au commencement, Dieu créa les cieux et la terre" },
    { reference: "Exode 20:12", text: "Honore ton père et ta mère" },
    { reference: "Psaume 46:1", text: "Dieu est pour nous un refuge et un appui" },
    { reference: "Proverbes 1:7", text: "La crainte de l'Éternel est le commencement de la science" },
    { reference: "Ésaïe 9:6", text: "Car un enfant nous est né, un fils nous est donné" },
    { reference: "Matthieu 6:33", text: "Cherchez premièrement le royaume et la justice de Dieu" },
    { reference: "Matthieu 5:14", text: "Vous êtes la lumière du monde" },
    { reference: "Jean 1:1", text: "Au commencement était la Parole" },
    { reference: "Actes 1:8", text: "Vous recevrez une puissance, le Saint-Esprit survenant sur vous" },
    { reference: "Romains 3:23", text: "Car tous ont péché et sont privés de la gloire de Dieu" },
    { reference: "1 Corinthiens 13:13", text: "La plus grande de ces choses, c'est l'amour" },
    { reference: "2 Corinthiens 5:17", text: "Si quelqu'un est en Christ, il est une nouvelle créature" },
    { reference: "Galates 2:20", text: "J'ai été crucifié avec Christ" },
    { reference: "Ephésiens 6:11", text: "Revêtez-vous de toutes les armes de Dieu" },
    { reference: "Philippiens 1:21", text: "Car Christ est ma vie, et la mort m'est un gain" },
    { reference: "Colossiens 3:17", text: "Quoi que vous fassiez, faites tout au nom du Seigneur Jésus" },
    { reference: "1 Thessaloniciens 5:17", text: "Priez sans cesse" },
    { reference: "2 Timothée 3:16", text: "Toute Écriture est inspirée de Dieu" },
    { reference: "Hébreux 4:12", text: "La parole de Dieu est vivante et efficace" },
    { reference: "Jacques 1:22", text: "Mettez en pratique la parole" },
    { reference: "1 Pierre 5:7", text: "Déchargez-vous sur lui de tous vos soucis" },
    { reference: "1 Jean 1:9", text: "Si nous confessons nos péchés, il est fidèle et juste" },
    { reference: "Apocalypse 22:13", text: "Je suis l'alpha et l'oméga" },
    { reference: "Romains 10:9", text: "Si tu confesses de ta bouche le Seigneur Jésus" },
    { reference: "Psaume 150:6", text: "Que tout ce qui respire loue l'Éternel" }
];

// Biblical words for Word Search
export const BIBLE_WORDS = {
    easy: [
        "JESUS", "DIEU", "AMOUR", "FOI", "PAIX", "JOIE", "GRACE", "ESPRIT",
        "BIBLE", "PRIERE", "AMEN", "CIEL", "VIE", "COEUR", "ANGE", "CROIX",
        "ARCHE", "LION", "PAIN", "VIN", "ROI", "FILS", "PERE", "MERE",
        "EAU", "FEU", "VENT", "NOEL", "PSAUME", "LIVRE", "SAINT", "JUSTE"
    ],
    medium: [
        "SALUT", "PARDON", "LOUANGE", "GLOIRE", "SAINTE", "VERITE", "LUMIERE",
        "BERGER", "TEMPLE", "ESPOIR", "SAGESSE", "JUSTICE", "PROMESSE", "ALLIANCE",
        "MIRACLE", "PARABOLE", "APOTRE", "DISCIPLE", "PROPHETE", "EVANGILE", "BAPTEME",
        "ETERNEL", "CREATEUR", "SAUVEUR", "MESSIE", "CHRIST", "SEPULCRE", "CALVAIRE",
        "GOLGOTHA", "NAZARETH", "GALILEE", "JOUDAIN", "DESERT", "MANNE", "AUTEL",
        "ENCENS", "TUNIQUE", "TABLES", "LOI", "PECHE", "ENFER", "PARADIS"
    ],
    hard: [
        "RESURRECTION", "REDEMPTION", "SANCTIFICATION", "JUSTIFICATION", "RECONCILIATION",
        "BENEDICTION", "REVELATION", "PERSECUTION", "CONVERSION", "INTERCESSION",
        "TRANSFIGURATION", "PENTECOTE", "TABERNACLE", "SACRIFICATEUR", "PHARISIEN",
        "SADDUCEEN", "SYNAGOGUE", "LEVITE", "SAMARITAIN", "CENTENIER", "GOUVERNEUR",
        "TRIBITIEN", "PROCURATEUR", "TETRARQUE", "APOCALYPSE", "EPIPHANIE", "ASCENSION",
        "CAREME", "EUCHARISTE", "COMMUNION", "ADOPTION", "PREDESTINATION", "GLORIFICATION",
        "EXPIATION", "PROPITIATION", "REGENERATION", "INCARNATION", "OMNIPRESENCE", "OMNISCIENCE"
    ],
    names: [
        "MOISE", "ABRAHAM", "DAVID", "SALOMON", "ELIE", "DANIEL", "PIERRE",
        "PAUL", "MARIE", "JOSEPH", "SAMUEL", "ESAIE", "JEREMIE",
        "NOE", "ADAM", "EVE", "ABEL", "CAIN", "SETH", "ENOCH", "METHUSALEM",
        "SARAH", "AGAR", "ISMAEL", "ISAAC", "REBECCA", "JACOB", "ESAU", "LEA",
        "RACHEL", "JOSEPH", "BENJAMIN", "JUDA", "LEVI", "AARON", "JOSUE", "CALEB",
        "GEDEON", "SAMSON", "RUTH", "BOAZ", "NAOMI", "ANNE", "SAUL", "JONATHAN",
        "GOLIATH", "ABSALOM", "BETHSABEE", "SALOMON", "REHABEAM", "JEROBOAM",
        "ELISEE", "NAAMAN", "JONAS", "OSEE", "JOEL", "AMOS", "ABDIAS", "MICHEE",
        "NAHUM", "HABACUC", "SOPHONIE", "AGGEE", "ZACHARIE", "MALACHIE", "JEAN",
        "JACQUES", "ANDRE", "PHILIPPE", "BARTHELEMY", "THOMAS", "MATTHIEU",
        "SIMON", "JUDAS", "MATTHIAS", "ETIENNE", "PHILIPPE", "BARNABAS", "SILAS",
        "TIMOTHEE", "TITE", "PHILEMON", "AQUILAS", "PRISCILLE", "APOLLOS"
    ],
    places: [
        "JERUSALEM", "BETHLEEM", "NAZARETH", "GALILEE", "EGYPTE", "JORDAN",
        "SINAI", "CANAAN", "BABEL", "EDEN", "JERICHO", "SODOME", "GOMORRE",
        "UR", "HARAN", "GOSEN", "MERROUGE", "MARAH", "ELIM", "REPHIDIM",
        "HOREB", "KADESH", "PISGA", "NEBO", "GILGAL", "AI", "GABAON", "HEBRON",
        "SILO", "BETHEL", "DAN", "BEERSHEBA", "SION", "MORIJA", "CARMEL",
        "SAMARIE", "NINIVE", "BABYLONE", "SUSE", "DAMAS", "ANTIOCHE", "TARSES",
        "CYPRE", "CRETE", "MALTE", "ROME", "CORINTHE", "EPHESE", "PHILIPPES",
        "THESSALONIQUE", "BEREE", "ATHENES", "CENCHREE", "LAODICEE", "SARDES",
        "PHILADELPHIE", "SMYRNE", "PERGAME", "THYATIRE", "PATMOS", "GETHSEMANE",
        "GOLGOTHA", "CANA", "CAPERNAUM", "BETHANIE", "EMMAUS", "SYCHAR"
    ]
};

// Bible characters for games
export const BIBLE_CHARACTERS = [
    { name: "Adam", role: "Premier homme", testament: "AT" },
    { name: "Ève", role: "Première femme", testament: "AT" },
    { name: "Noé", role: "Constructeur de l'arche", testament: "AT" },
    { name: "Abraham", role: "Père de la foi", testament: "AT" },
    { name: "Moïse", role: "Libérateur d'Israël", testament: "AT" },
    { name: "David", role: "Roi berger", testament: "AT" },
    { name: "Salomon", role: "Roi sage", testament: "AT" },
    { name: "Daniel", role: "Prophète dans la fosse aux lions", testament: "AT" },
    { name: "Élie", role: "Prophète de feu", testament: "AT" },
    { name: "Jonas", role: "Prophète et le grand poisson", testament: "AT" },
    { name: "Jésus", role: "Fils de Dieu, Sauveur", testament: "NT" },
    { name: "Marie", role: "Mère de Jésus", testament: "NT" },
    { name: "Joseph", role: "Père adoptif de Jésus", testament: "NT" },
    { name: "Pierre", role: "Apôtre, Pierre de l'Église", testament: "NT" },
    { name: "Paul", role: "Apôtre des nations", testament: "NT" },
    { name: "Jean", role: "L'apôtre que Jésus aimait", testament: "NT" },
    { name: "Lazare", role: "Ressuscité par Jésus", testament: "NT" },
    { name: "Marthe", role: "Sœur de Marie et Lazare", testament: "NT" },
    // ADDITIONAL CHARACTERS
    { name: "Sarah", role: "Femme d'Abraham", testament: "AT" },
    { name: "Isaac", role: "Fils de la promesse", testament: "AT" },
    { name: "Jacob", role: "Père des 12 tribus", testament: "AT" },
    { name: "Joseph", role: "Fils de Jacob, prince d'Égypte", testament: "AT" },
    { name: "Aaron", role: "Premier grand prêtre", testament: "AT" },
    { name: "Josué", role: "Successeur de Moïse", testament: "AT" },
    { name: "Gédéon", role: "Juge vaillant", testament: "AT" },
    { name: "Samson", role: "Juge à la force surnaturelle", testament: "AT" },
    { name: "Ruth", role: "Moabite fidèle", testament: "AT" },
    { name: "Samuel", role: "Dernier juge et prophète", testament: "AT" },
    { name: "Saül", role: "Premier roi d'Israël", testament: "AT" },
    { name: "Jonathan", role: "Ami fidèle de David", testament: "AT" },
    { name: "Absalom", role: "Fils rebelle de David", testament: "AT" },
    { name: "Ézéchias", role: "Roi fidèle de Juda", testament: "AT" },
    { name: "Élisée", role: "Prophète successeur d'Élie", testament: "AT" },
    { name: "Néhémie", role: "Reconstructeur des murailles", testament: "AT" },
    { name: "Esther", role: "Reine courageuse", testament: "AT" },
    { name: "Job", role: "Homme patient dans l'épreuve", testament: "AT" },
    { name: "Ézéchiel", role: "Prophète des visions", testament: "AT" },
    { name: "Jean-Baptiste", role: "Précurseur de Jésus", testament: "NT" },
    { name: "Marie-Madeleine", role: "Disciple fidèle", testament: "NT" },
    { name: "Zachée", role: "Collecteur d'impôts converti", testament: "NT" },
    { name: "Nicodème", role: "Pharisien venu voir Jésus de nuit", testament: "NT" },
    { name: "Thomas", role: "Disciple qui a douté", testament: "NT" },
    { name: "Étienne", role: "Premier martyr", testament: "NT" },
    { name: "Barnabas", role: "Fils de consolation", testament: "NT" },
    { name: "Timothée", role: "Fils spirituel de Paul", testament: "NT" },
    { name: "Luc", role: "Médecin bien-aimé", testament: "NT" },
    { name: "Marc", role: "Auteur du second évangile", testament: "NT" },
    { name: "Philémon", role: "Destinataire d'une lettre de Paul", testament: "NT" }
];

// Chronological Bible events for chronology game - ORDERED from oldest to newest
export const CHRONO_EVENTS = [
    { id: "creation", event: "Création du monde", year: "Au commencement" },
    { id: "adam_eve", event: "Adam et Ève dans le jardin d'Éden", year: "~4000 av. J.-C." },
    { id: "fall", event: "La chute de l'homme", year: "~4000 av. J.-C." },
    { id: "cain_abel", event: "Caïn tue Abel", year: "~4000 av. J.-C." },
    { id: "flood", event: "Le déluge de Noé", year: "~2500 av. J.-C." },
    { id: "babel", event: "La tour de Babel", year: "~2200 av. J.-C." },
    { id: "abraham_call", event: "L'appel d'Abraham", year: "~2000 av. J.-C." },
    { id: "isaac_birth", event: "Naissance d'Isaac", year: "~1900 av. J.-C." },
    { id: "jacob_esau", event: "Jacob et Ésaü", year: "~1850 av. J.-C." },
    { id: "joseph_egypt", event: "Joseph vendu en Égypte", year: "~1720 av. J.-C." },
    { id: "moses_birth", event: "Naissance de Moïse", year: "~1530 av. J.-C." },
    { id: "burning_bush", event: "Le buisson ardent", year: "~1490 av. J.-C." },
    { id: "plagues", event: "Les 10 plaies d'Égypte", year: "~1450 av. J.-C." },
    { id: "exodus", event: "L'Exode d'Égypte", year: "~1450 av. J.-C." },
    { id: "red_sea", event: "Traversée de la Mer Rouge", year: "~1450 av. J.-C." },
    { id: "ten_commandments", event: "Les dix commandements", year: "~1450 av. J.-C." },
    { id: "golden_calf", event: "Le veau d'or", year: "~1450 av. J.-C." },
    { id: "tabernacle", event: "Construction du Tabernacle", year: "~1449 av. J.-C." },
    { id: "spies", event: "Les 12 espions en Canaan", year: "~1448 av. J.-C." },
    { id: "moses_death", event: "Mort de Moïse", year: "~1410 av. J.-C." },
    { id: "jericho", event: "Chute de Jéricho", year: "~1400 av. J.-C." },
    { id: "judges_period", event: "Période des Juges", year: "~1375-1050 av. J.-C." },
    { id: "gideon", event: "Gédéon et les 300 hommes", year: "~1160 av. J.-C." },
    { id: "samson", event: "Samson juge d'Israël", year: "~1100 av. J.-C." },
    { id: "samuel_birth", event: "Naissance de Samuel", year: "~1080 av. J.-C." },
    { id: "saul_king", event: "Saül devient roi", year: "~1050 av. J.-C." },
    { id: "david_king", event: "David devient roi", year: "~1010 av. J.-C." },
    { id: "david_goliath", event: "David vainc Goliath", year: "~1025 av. J.-C." },
    { id: "solomon_temple", event: "Construction du temple de Salomon", year: "~960 av. J.-C." },
    { id: "kingdom_split", event: "Division du royaume (Israël/Juda)", year: "~931 av. J.-C." },
    { id: "elijah_prophets", event: "Élie et les prophètes de Baal", year: "~870 av. J.-C." },
    { id: "jonah_nineveh", event: "Jonas à Ninive", year: "~760 av. J.-C." },
    { id: "israel_fall", event: "Chute du royaume d'Israël (Nord)", year: "~722 av. J.-C." },
    { id: "babylonian_exile", event: "Exil à Babylone (Chute de Juda)", year: "~586 av. J.-C." },
    { id: "daniel_lions", event: "Daniel dans la fosse aux lions", year: "~539 av. J.-C." },
    { id: "cyrus_decree", event: "Décret de Cyrus (Retour)", year: "~538 av. J.-C." },
    { id: "temple_rebuilt", event: "Reconstruction du temple", year: "~516 av. J.-C." },
    { id: "esther_queen", event: "Esther devient reine", year: "~479 av. J.-C." },
    { id: "nehemiah_wall", event: "Reconstruction des murailles", year: "~445 av. J.-C." },
    { id: "malachi", event: "Prophétie de Malachie", year: "~430 av. J.-C." },
    { id: "jesus_birth", event: "Naissance de Jésus", year: "~4 av. J.-C." },
    { id: "jesus_baptism", event: "Baptême de Jésus", year: "~27 ap. J.-C." },
    { id: "transfiguration", event: "La Transfiguration", year: "~29 ap. J.-C." },
    { id: "triumphal_entry", event: "Entrée triomphale à Jérusalem", year: "~30 ap. J.-C." },
    { id: "last_supper", event: "La Cène", year: "~30 ap. J.-C." },
    { id: "crucifixion", event: "Crucifixion de Jésus", year: "~30 ap. J.-C." },
    { id: "resurrection", event: "Résurrection de Jésus", year: "~30 ap. J.-C." },
    { id: "ascension", event: "L'Ascension", year: "~30 ap. J.-C." },
    { id: "pentecost", event: "La Pentecôte", year: "~30 ap. J.-C." },
    { id: "stephen_martyr", event: "Lapidation d'Étienne", year: "~34 ap. J.-C." },
    { id: "paul_conversion", event: "Conversion de Paul", year: "~35 ap. J.-C." },
    { id: "peter_cornelius", event: "Pierre chez Corneille", year: "~38 ap. J.-C." },
    { id: "first_journey", event: "Premier voyage missionnaire de Paul", year: "~46-48 ap. J.-C." },
    { id: "first_council", event: "Concile de Jérusalem", year: "~50 ap. J.-C." },
    { id: "second_journey", event: "Deuxième voyage missionnaire", year: "~50-52 ap. J.-C." },
    { id: "third_journey", event: "Troisième voyage missionnaire", year: "~53-57 ap. J.-C." },
    { id: "paul_arrest", event: "Arrestation de Paul à Jérusalem", year: "~58 ap. J.-C." },
    { id: "paul_rome", event: "Paul prisonnier à Rome", year: "~60-62 ap. J.-C." },
    { id: "temple_destruction", event: "Destruction du temple de Jérusalem", year: "~70 ap. J.-C." },
    { id: "revelation", event: "Jean écrit l'Apocalypse", year: "~95 ap. J.-C." },
];

// Characters for "Who Am I?" game with clues
export const WHO_AM_I_CHARACTERS = [
    {
        id: "moses",
        name: "Moïse",
        clues: [
            "J'ai été sauvé des eaux étant bébé",
            "J'ai conduit mon peuple hors d'Égypte",
            "J'ai reçu les dix commandements sur une montagne"
        ]
    },
    {
        id: "david",
        name: "David",
        clues: [
            "J'étais berger avant de devenir roi",
            "J'ai vaincu un géant avec une fronde",
            "J'ai écrit beaucoup de psaumes"
        ]
    },
    {
        id: "abraham",
        name: "Abraham",
        clues: [
            "Dieu m'a promis une descendance nombreuse",
            "Ma femme s'appelait Sarah",
            "Je suis appelé le père de la foi"
        ]
    },
    {
        id: "joseph",
        name: "Joseph",
        clues: [
            "Mes frères m'ont vendu comme esclave",
            "J'ai interprété les rêves de Pharaon",
            "J'avais une tunique de plusieurs couleurs"
        ]
    },
    {
        id: "paul",
        name: "Paul",
        clues: [
            "J'ai persécuté les chrétiens avant ma conversion",
            "J'ai été aveuglé sur le chemin de Damas",
            "J'ai écrit de nombreuses lettres aux églises"
        ]
    },
    {
        id: "peter",
        name: "Pierre",
        clues: [
            "J'étais pêcheur avant de suivre Jésus",
            "J'ai marché sur l'eau",
            "J'ai renié Jésus trois fois"
        ]
    },
    {
        id: "daniel",
        name: "Daniel",
        clues: [
            "J'ai été jeté dans une fosse aux lions",
            "J'ai interprété les rêves du roi Nebucadnetsar",
            "J'ai vu une écriture mystérieuse sur un mur"
        ]
    },
    {
        id: "noah",
        name: "Noé",
        clues: [
            "J'ai construit un grand bateau",
            "J'ai sauvé des animaux deux par deux",
            "J'ai vu un arc-en-ciel comme signe d'alliance"
        ]
    },
    {
        id: "mary",
        name: "Marie",
        clues: [
            "Un ange m'a annoncé une nouvelle extraordinaire",
            "Mon fils est né dans une étable",
            "Je suis la mère du Sauveur"
        ]
    },
    {
        id: "samson",
        name: "Samson",
        clues: [
            "Ma force était dans mes cheveux",
            "J'ai été trahi par Dalila",
            "J'ai détruit le temple des Philistins"
        ]
    },
    {
        id: "elijah",
        name: "Élie",
        clues: [
            "J'ai été nourri par des corbeaux",
            "J'ai combattu les prophètes de Baal au mont Carmel",
            "J'ai été enlevé au ciel dans un char de feu"
        ]
    },
    {
        id: "ruth",
        name: "Ruth",
        clues: [
            "Je suis une Moabite qui a suivi sa belle-mère",
            "J'ai dit: 'Ton peuple sera mon peuple'",
            "Je suis une ancêtre du roi David du côté de son père"
        ]
    },
    {
        id: "jonah",
        name: "Jonas",
        clues: [
            "J'ai fui l'appel de Dieu en bateau",
            "J'ai passé trois jours dans le ventre d'un gros poisson",
            "J'ai prêché à Ninive"
        ]
    },
    {
        id: "solomon",
        name: "Salomon",
        clues: [
            "J'ai demandé la sagesse à Dieu",
            "J'ai construit le premier temple de Jérusalem",
            "J'ai écrit des proverbes et des cantiques"
        ]
    },
    {
        id: "esther",
        name: "Esther",
        clues: [
            "Je suis devenue reine de Perse",
            "J'ai sauvé mon peuple d'un complot",
            "Mon cousin s'appelait Mardochée"
        ]
    },
    {
        id: "john_baptist",
        name: "Jean-Baptiste",
        clues: [
            "Je portais un vêtement en poils de chameau",
            "Je me nourrissais de sauterelles et de miel sauvage",
            "J'ai dit : « Voici l'Agneau de Dieu qui ôte le péché du monde »"
        ]
    },
    {
        id: "stephen",
        name: "Étienne",
        clues: [
            "J'ai été un des sept premiers diacres",
            "J'ai vu les cieux ouverts et le Fils de l'homme debout",
            "Je suis le premier martyr chrétien"
        ]
    },
    {
        id: "sarah",
        name: "Sarah",
        clues: [
            "J'ai ri quand j'ai appris que j'aurais un fils",
            "J'ai eu un enfant à l'âge de 90 ans",
            "Je suis la femme d'Abraham"
        ]
    },
    {
        id: "job",
        name: "Job",
        clues: [
            "J'étais l'homme le plus riche de l'Orient",
            "J'ai tout perdu en un jour mais je n'ai pas maudit Dieu",
            "J'ai dit : « Mon rédempteur est vivant »"
        ]
    },
    {
        id: "jacob",
        name: "Jacob",
        clues: [
            "J'ai tenu le talon de mon frère à la naissance",
            "J'ai lutté avec un ange toute la nuit",
            "Mon nom a été changé en Israël"
        ]
    },
    {
        id: "nehemiah",
        name: "Néhémie",
        clues: [
            "J'étais échanson du roi de Perse",
            "J'ai pleuré en apprenant l'état de Jérusalem",
            "J'ai reconstruit la muraille de Jérusalem en 52 jours"
        ]
    },
    {
        id: "isaac",
        name: "Isaac",
        clues: [
            "Mon nom signifie « Rire »",
            "J'ai été offert en sacrifice sur le mont Morija",
            "J'ai épousé Rébecca"
        ]
    },
    {
        id: "gideon",
        name: "Gédéon",
        clues: [
            "Je battais du froment au pressoir pour le cacher",
            "J'ai demandé un signe avec une peau de mouton",
            "J'ai vaincu les Madianites avec 300 hommes, des trompettes et des flambeaux"
        ]
    },
    {
        id: "mary_magdalene",
        name: "Marie-Madeleine",
        clues: [
            "Jésus a chassé sept démons de moi",
            "J'étais présente au pied de la croix",
            "J'ai été la première à voir Jésus ressuscité"
        ]
    },
    {
        id: "zacchaeus",
        name: "Zachée",
        clues: [
            "J'étais un chef des collecteurs d'impôts et très riche",
            "Je suis monté sur un sycomore pour voir Jésus",
            "Jésus est venu loger chez moi"
        ]
    }
];

// Get random questions for quiz
export function getRandomQuestions(count: number, difficulty?: 'easy' | 'medium' | 'hard'): typeof BIBLE_QUESTIONS {
    let questions = [...BIBLE_QUESTIONS];

    if (difficulty) {
        questions = questions.filter(q => q.difficulty === difficulty);
    }

    // Shuffle
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return questions.slice(0, count);
}

// Get pairs for memory game
export function getMemoryPairs(count: number): typeof BIBLE_VERSES_PAIRS {
    const pairs = [...BIBLE_VERSES_PAIRS];

    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    return pairs.slice(0, count);
}

// Get words for word search
export function getWordSearchWords(count: number, category?: keyof typeof BIBLE_WORDS): string[] {
    let words: string[] = [];

    if (category) {
        words = [...BIBLE_WORDS[category]];
    } else {
        // Mix from all categories
        Object.values(BIBLE_WORDS).forEach(arr => {
            words.push(...arr);
        });
    }

    // Shuffle
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }

    return words.slice(0, count);
}

// Get random chronological events for chrono game
export function getRandomChronoEvents(count: number = 5): typeof CHRONO_EVENTS {
    const events = [...CHRONO_EVENTS];

    // Shuffle
    for (let i = events.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [events[i], events[j]] = [events[j], events[i]];
    }

    return events.slice(0, count);
}

// Get random characters for "Who Am I?" game
export function getRandomWhoAmICharacters(count: number = 5): typeof WHO_AM_I_CHARACTERS {
    const characters = [...WHO_AM_I_CHARACTERS];

    // Shuffle
    for (let i = characters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [characters[i], characters[j]] = [characters[j], characters[i]];
    }

    return characters.slice(0, count);
}

// Generate game configuration based on game type
export async function generateGameConfig(gameType: string): Promise<any> {
    switch (gameType) {
        case 'bible_memory':
            return {
                pairs: getMemoryPairs(8),
                type: 'memory'
            };

        case 'quiz_duel':
            return {
                questions: getRandomQuestions(10),
                type: 'quiz'
            };

        case 'who_am_i':
            return {
                characters: getRandomWhoAmICharacters(5),
                type: 'who_am_i'
            };

        case 'chrono':
            return {
                events: getRandomChronoEvents(6),
                type: 'chrono'
            };

        case 'word_search':
            return {
                words: getWordSearchWords(10),
                type: 'word_search',
                gridSize: 12
            };

        default:
            return {
                questions: getRandomQuestions(10),
                type: 'quiz'
            };
    }
}

// All exports are named exports above (BIBLE_QUESTIONS, BIBLE_WORDS, etc.)
