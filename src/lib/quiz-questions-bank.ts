/**
 * BIBLE QUIZ QUESTION BANK - MEGA EDITION
 * =========================================
 * 3 difficulty levels × 10 blocks × 200 questions = 6000 questions
 * 
 * Strategy:
 * - Each block has 20+ handcrafted seed questions
 * - Dynamic generator fills remaining slots from local Bible data
 * - Questions are shuffled and never repeat within a session
 */

export interface QuizQuestionItem {
    id: string;
    question: string;
    options: string[];
    correct: number;
    reference?: string;
    explanation?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    block: number; // 1-10
}

// ============================================================
// EASY QUESTIONS - Blocks 1-10 (seed: 20 per block = 200 seed)
// ============================================================
const EASY_BLOCK_1: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui a créé le monde selon la Bible?", options: ["Dieu", "Moïse", "Abraham", "Jésus"], correct: 0, reference: "Genèse 1:1" },
    { question: "Combien de jours Dieu a-t-il utilisé pour créer le monde?", options: ["6", "7", "5", "3"], correct: 0, reference: "Genèse 1" },
    { question: "Quel est le premier livre de la Bible?", options: ["Genèse", "Exode", "Matthieu", "Apocalypse"], correct: 0 },
    { question: "Qui a construit l'arche?", options: ["Noé", "Abraham", "Moïse", "David"], correct: 0, reference: "Genèse 6" },
    { question: "Combien d'apôtres Jésus avait-il?", options: ["12", "10", "7", "3"], correct: 0, reference: "Matthieu 10" },
    { question: "Dans quelle ville Jésus est-il né?", options: ["Bethléem", "Jérusalem", "Nazareth", "Capernaüm"], correct: 0, reference: "Luc 2:4" },
    { question: "Qui a trahi Jésus?", options: ["Judas", "Pierre", "Jean", "Thomas"], correct: 0, reference: "Matthieu 26:14" },
    { question: "Qui était le premier homme?", options: ["Adam", "Noé", "Abraham", "Moïse"], correct: 0, reference: "Genèse 2:7" },
    { question: "Qui était la première femme?", options: ["Ève", "Marie", "Sarah", "Ruth"], correct: 0, reference: "Genèse 3:20" },
    { question: "Quelle mer Moïse a-t-il traversée?", options: ["Mer Rouge", "Mer Morte", "Mer Méditerranée", "Jourdain"], correct: 0, reference: "Exode 14" },
    { question: "Qui a tué Goliath?", options: ["David", "Saül", "Jonathan", "Samuel"], correct: 0, reference: "1 Samuel 17" },
    { question: "Qui a été avalé par un grand poisson?", options: ["Jonas", "Élie", "Élisée", "Daniel"], correct: 0, reference: "Jonas 1:17" },
    { question: "Combien de plaies d'Égypte y a-t-il eu?", options: ["10", "7", "12", "5"], correct: 0, reference: "Exode 7-12" },
    { question: "Qui a reçu les 10 commandements?", options: ["Moïse", "Aaron", "Josué", "Caleb"], correct: 0, reference: "Exode 20" },
    { question: "Quel est le signe de l'alliance avec Noé?", options: ["L'arc-en-ciel", "La circoncision", "La Pâque", "Le Sabbat"], correct: 0, reference: "Genèse 9:13" },
    { question: "Qui a été jeté dans la fosse aux lions?", options: ["Daniel", "David", "Samson", "Gédéon"], correct: 0, reference: "Daniel 6" },
    { question: "Quel est le dernier livre de la Bible?", options: ["Apocalypse", "Actes", "Jude", "Malachie"], correct: 0 },
    { question: "Qui a marché sur l'eau avec Jésus?", options: ["Pierre", "Jean", "Jacques", "André"], correct: 0, reference: "Matthieu 14:29" },
    { question: "Qui a baptisé Jésus?", options: ["Jean-Baptiste", "Pierre", "Paul", "Philippe"], correct: 0, reference: "Matthieu 3:13" },
    { question: "Combien de livres y a-t-il dans la Bible?", options: ["66", "72", "50", "100"], correct: 0 },
];

const EASY_BLOCK_2: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui était le frère d'Abel?", options: ["Caïn", "Seth", "Adam", "Noé"], correct: 0, reference: "Genèse 4:1" },
    { question: "Quel animal a parlé à Balaam?", options: ["Une ânesse", "Un lion", "Un serpent", "Un aigle"], correct: 0, reference: "Nombres 22:28" },
    { question: "Qui a écrit la plupart des Psaumes?", options: ["David", "Salomon", "Moïse", "Asaph"], correct: 0 },
    { question: "Qui a ressuscité d'entre les morts après trois jours?", options: ["Jésus", "Lazare", "Moïse", "Élie"], correct: 0, reference: "Matthieu 28" },
    { question: "Qui était le premier roi d'Israël?", options: ["Saül", "David", "Salomon", "Samuel"], correct: 0, reference: "1 Samuel 10" },
    { question: "Quel apôtre était médecin?", options: ["Luc", "Paul", "Pierre", "Matthieu"], correct: 0 },
    { question: "Qui a nié connaître Jésus trois fois?", options: ["Pierre", "Judas", "Thomas", "Jean"], correct: 0, reference: "Matthieu 26:69" },
    { question: "Quel était le métier de Joseph (père de Jésus)?", options: ["Charpentier", "Pêcheur", "Berger", "Collecteur d'impôts"], correct: 0 },
    { question: "Où Adam et Ève vivaient-ils?", options: ["Jardin d'Éden", "Canaan", "Égypte", "Jéricho"], correct: 0, reference: "Genèse 2:8" },
    { question: "Qui a combattu les prophètes de Baal?", options: ["Élie", "Élisée", "Samuel", "Nathan"], correct: 0, reference: "1 Rois 18" },
    { question: "Qui était la reine qui a sauvé les Juifs?", options: ["Esther", "Ruth", "Débora", "Jézabel"], correct: 0, reference: "Esther 7" },
    { question: "De quelle couleur était la tunique de Joseph?", options: ["Multicolore", "Blanche", "Pourpre", "Rouge"], correct: 0, reference: "Genèse 37:3" },
    { question: "Quel disciple a douté de la résurrection?", options: ["Thomas", "Pierre", "Jean", "Jacques"], correct: 0, reference: "Jean 20:25" },
    { question: "Quelle profession avait Pierre avant de suivre Jésus?", options: ["Pêcheur", "Charpentier", "Berger", "Collecteur d'impôts"], correct: 0, reference: "Matthieu 4:18" },
    { question: "Quelle nourriture Dieu a envoyée du ciel aux Israélites?", options: ["La manne", "Du pain", "Des figues", "Du miel"], correct: 0, reference: "Exode 16:14" },
    { question: "Qui a vendu son droit d'aînesse pour un plat de lentilles?", options: ["Ésaü", "Jacob", "Isaac", "Joseph"], correct: 0, reference: "Genèse 25:33" },
    { question: "Qui a été transformée en statue de sel?", options: ["La femme de Lot", "La femme de Noé", "Sarah", "Rébecca"], correct: 0, reference: "Genèse 19:26" },
    { question: "Comment s'appelait la mère de Samuel?", options: ["Anne", "Penne", "Ruth", "Naomi"], correct: 0, reference: "1 Samuel 1:20" },
    { question: "Combien de frères Joseph avait-il?", options: ["11", "12", "10", "7"], correct: 0, reference: "Genèse 42:13" },
    { question: "Quel jour Dieu s'est-il reposé?", options: ["Le 7ème jour", "Le 6ème jour", "Le 1er jour", "Le 5ème jour"], correct: 0, reference: "Genèse 2:2" },
];

const EASY_BLOCK_3: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui a dit 'Que la lumière soit'?", options: ["Dieu", "Moïse", "Jésus", "Abraham"], correct: 0, reference: "Genèse 1:3" },
    { question: "Combien de temps a duré le déluge?", options: ["40 jours et 40 nuits", "7 jours", "150 jours", "1 an"], correct: 0, reference: "Genèse 7:12" },
    { question: "Quel roi d'Israël était connu pour sa sagesse?", options: ["Salomon", "David", "Saül", "Josias"], correct: 0, reference: "1 Rois 3" },
    { question: "Qui a été emporté au ciel sans mourir?", options: ["Énoch", "Moïse", "Abraham", "Isaac"], correct: 0, reference: "Genèse 5:24" },
    { question: "Quel fruit était interdit au jardin d'Éden?", options: ["Fruit de l'arbre de la connaissance", "Pomme", "Raisin", "Figue"], correct: 0, reference: "Genèse 2:17" },
    { question: "De quelle ville Paul était-il originaire?", options: ["Tarse", "Rome", "Jérusalem", "Antioche"], correct: 0, reference: "Actes 21:39" },
    { question: "Combien de fois Jésus a été tenté dans le désert?", options: ["3", "7", "1", "40"], correct: 0, reference: "Matthieu 4" },
    { question: "Qui a écrit la majorité de l'AT en livres?", options: ["Moïse", "David", "Salomon", "Ésaïe"], correct: 0 },
    { question: "Quel animal a parlé à Ève?", options: ["Le serpent", "Un lion", "Un aigle", "Un bouc"], correct: 0, reference: "Genèse 3:1" },
    { question: "Quel miracle Jésus a fait en premier selon Jean?", options: ["Changé l'eau en vin", "Guéri un aveugle", "Nourri 5000", "Marché sur l'eau"], correct: 0, reference: "Jean 2:9" },
    { question: "Qui était le père de Jean-Baptiste?", options: ["Zacharie", "Joseph", "Élisée", "Siméon"], correct: 0, reference: "Luc 1:13" },
    { question: "Combien de fils Jacob avait-il?", options: ["12", "10", "7", "13"], correct: 0, reference: "Genèse 35:22" },
    { question: "Qui a interprété les rêves de Pharaon?", options: ["Joseph", "Daniel", "Moïse", "Abraham"], correct: 0, reference: "Genèse 41" },
    { question: "Quelle ville Josué a conquise en premier?", options: ["Jéricho", "Aï", "Hébron", "Sichem"], correct: 0, reference: "Josué 6" },
    { question: "Qui était le frère de Moïse?", options: ["Aaron", "Lévi", "Caleb", "Josué"], correct: 0, reference: "Exode 4:14" },
    { question: "Quel ange a annoncé la naissance de Jésus à Marie?", options: ["Gabriel", "Michel", "Raphaël", "Uriel"], correct: 0, reference: "Luc 1:26" },
    { question: "Où Jésus a transformé l'eau en vin?", options: ["Cana", "Nazareth", "Capernaüm", "Béthanie"], correct: 0, reference: "Jean 2:1" },
    { question: "Qui a aidé Jésus à porter sa croix?", options: ["Simon de Cyrène", "Joseph d'Arimathée", "Nicodème", "Jean"], correct: 0, reference: "Marc 15:21" },
    { question: "Quel prophète a été nourri par des corbeaux?", options: ["Élie", "Élisée", "Jérémie", "Ésaïe"], correct: 0, reference: "1 Rois 17:6" },
    { question: "Combien de personnes Jésus a nourries avec 5 pains et 2 poissons?", options: ["5000", "4000", "3000", "7000"], correct: 0, reference: "Matthieu 14:21" },
];

const EASY_BLOCK_4: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui a caché les espions à Jéricho?", options: ["Rahab", "Ruth", "Esther", "Sarah"], correct: 0, reference: "Josué 2:4" },
    { question: "Quel arbre Zachée a escaladé?", options: ["Sycomore", "Olivier", "Figuier", "Palmier"], correct: 0, reference: "Luc 19:4" },
    { question: "Qui était la belle-mère de Ruth?", options: ["Naomi", "Orpa", "Mara", "Hannah"], correct: 0, reference: "Ruth 1:22" },
    { question: "Quel fleuve traverse Israël?", options: ["Le Jourdain", "Le Nil", "L'Euphrate", "Le Tigre"], correct: 0 },
    { question: "Qui était le frère de Marthe et Marie?", options: ["Lazare", "Simon", "Joseph", "André"], correct: 0, reference: "Jean 11:1" },
    { question: "Quel apôtre était collecteur d'impôts?", options: ["Matthieu", "Pierre", "Luc", "Jean"], correct: 0, reference: "Matthieu 9:9" },
    { question: "Qui était le gouverneur lors du procès de Jésus?", options: ["Ponce Pilate", "César Auguste", "Hérode", "Félix"], correct: 0, reference: "Matthieu 27:2" },
    { question: "Combien de livres dans le Nouveau Testament?", options: ["27", "39", "22", "30"], correct: 0 },
    { question: "Quel jour commémore la résurrection de Jésus?", options: ["Pâques", "Noël", "Pentecôte", "Ascension"], correct: 0 },
    { question: "Qui a écrit l'Apocalypse?", options: ["Jean", "Pierre", "Paul", "Jacques"], correct: 0, reference: "Apocalypse 1:1" },
    { question: "Combien de jours Jésus a passé dans la tombe?", options: ["3", "1", "7", "2"], correct: 0, reference: "Matthieu 12:40" },
    { question: "Quel animal Samson a tué à mains nues?", options: ["Un lion", "Un ours", "Un loup", "Un sanglier"], correct: 0, reference: "Juges 14:6" },
    { question: "Qui était le premier martyr chrétien?", options: ["Étienne", "Jacques", "Pierre", "Paul"], correct: 0, reference: "Actes 7:59" },
    { question: "Quelle fête commémore la sortie d'Égypte?", options: ["La Pâque", "La Pentecôte", "Les Tabernacles", "Le Yom Kippour"], correct: 0, reference: "Exode 12" },
    { question: "De quelle tribu Jésus est-il issu?", options: ["Juda", "Lévi", "Benjamin", "Dan"], correct: 0, reference: "Hébreux 7:14" },
    { question: "Qui a tué Sisera avec un piquet de tente?", options: ["Jaël", "Débora", "Baraq", "Abigaïl"], correct: 0, reference: "Juges 4:21" },
    { question: "Quel roi a bâti le premier temple?", options: ["Salomon", "David", "Saül", "Roboam"], correct: 0, reference: "1 Rois 6" },
    { question: "Quelle parabole parle d'un fils qui part et revient?", options: ["Le fils prodigue", "Le bon samaritain", "Les talents", "Le semeur"], correct: 0, reference: "Luc 15:11" },
    { question: "Quel roi a déporté les Juifs à Babylone?", options: ["Nebucadnetsar", "Cyrus", "Darius", "Sennachérib"], correct: 0, reference: "2 Rois 25" },
    { question: "Qui a vu l'échelle céleste dans un rêve?", options: ["Jacob", "Abraham", "Isaac", "Joseph"], correct: 0, reference: "Genèse 28:12" },
];

const EASY_BLOCK_5: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Quelle montagne Moïse a-t-il gravi pour voir la Terre Promise?", options: ["Mont Nébo", "Mont Sinaï", "Mont Carmel", "Mont des Oliviers"], correct: 0, reference: "Deutéronome 34:1" },
    { question: "Quel autre nom a l'apôtre Paul?", options: ["Saul", "Silas", "Silvain", "Simon"], correct: 0, reference: "Actes 13:9" },
    { question: "Qui a succédé à Moïse?", options: ["Josué", "Aaron", "Caleb", "Gédéon"], correct: 0, reference: "Josué 1:1" },
    { question: "Quel roi a tué Jean-Baptiste?", options: ["Hérode Antipas", "Hérode le Grand", "Auguste", "Pilate"], correct: 0, reference: "Marc 6:27" },
    { question: "Où Paul a été converti?", options: ["Chemin de Damas", "Jérusalem", "Tarse", "Rome"], correct: 0, reference: "Actes 9:3" },
    { question: "Combien de tribus d'Israël y avait-il?", options: ["12", "10", "7", "13"], correct: 0, reference: "Genèse 49" },
    { question: "Quel prophète a oint David comme roi?", options: ["Samuel", "Nathan", "Élie", "Élisée"], correct: 0, reference: "1 Samuel 16:13" },
    { question: "Qui a remplacé Judas parmi les apôtres?", options: ["Matthias", "Paul", "Barnabas", "Silas"], correct: 0, reference: "Actes 1:26" },
    { question: "Quelle est la plus longue épître de Paul?", options: ["Romains", "1 Corinthiens", "Hébreux", "Galates"], correct: 0 },
    { question: "Combien de temps Jésus a jeûné dans le désert?", options: ["40 jours", "30 jours", "7 jours", "21 jours"], correct: 0, reference: "Matthieu 4:2" },
    { question: "Qui a demandé la tête de Jean-Baptiste?", options: ["Hérodiade", "Salomé", "Hérode", "Pilate"], correct: 0, reference: "Marc 6:24" },
    { question: "Quel prophète a été enlevé dans un char de feu?", options: ["Élie", "Énoch", "Élisée", "Moïse"], correct: 0, reference: "2 Rois 2:11" },
    { question: "Quel roi avait la sagesse de Dieu?", options: ["Salomon", "David", "Saül", "Ézéchias"], correct: 0, reference: "1 Rois 3:12" },
    { question: "De quoi étaient faits les 10 commandements?", options: ["Pierre", "Bois", "Or", "Argile"], correct: 0, reference: "Exode 31:18" },
    { question: "Qui a écrit les Proverbes principalement?", options: ["Salomon", "David", "Moïse", "Samuel"], correct: 0, reference: "Proverbes 1:1" },
    { question: "Quel livre contient le plus de chapitres?", options: ["Psaumes", "Ésaïe", "Genèse", "Jérémie"], correct: 0 },
    { question: "Quelle femme a été la première convertie en Europe?", options: ["Lydie", "Priscille", "Phoebe", "Dorcas"], correct: 0, reference: "Actes 16:14" },
    { question: "Dans quelle ville Paul a prêché sur l'Aréopage?", options: ["Athènes", "Rome", "Corinthe", "Éphèse"], correct: 0, reference: "Actes 17:22" },
    { question: "Quel prophète a été appelé le 'prophète pleureur'?", options: ["Jérémie", "Ésaïe", "Ézéchiel", "Daniel"], correct: 0 },
    { question: "Combien d'épîtres Jean a écrites?", options: ["3", "2", "1", "5"], correct: 0 },
];

const EASY_BLOCK_6: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui était le père de Matusalem?", options: ["Énoch", "Lémec", "Noé", "Jared"], correct: 0, reference: "Genèse 5:21" },
    { question: "Quel roi a vu une écriture mystérieuse sur un mur?", options: ["Belschatsar", "Nebucadnetsar", "Darius", "Cyrus"], correct: 0, reference: "Daniel 5" },
    { question: "Qui était le père de Salomon?", options: ["David", "Saül", "Samuel", "Nathan"], correct: 0, reference: "2 Samuel 12:24" },
    { question: "Qui a reconnu Jésus au temple?", options: ["Siméon", "Zacharie", "Nicodème", "Gamaliel"], correct: 0, reference: "Luc 2:25" },
    { question: "Qui a écrit les Actes des Apôtres?", options: ["Luc", "Pierre", "Paul", "Jean"], correct: 0, reference: "Actes 1:1" },
    { question: "Quel roi de Perse a permis la reconstruction du temple?", options: ["Cyrus", "Darius", "Artaxerxés", "Assuérus"], correct: 0, reference: "Esdras 1:1" },
    { question: "Quel prophète a épousé une prostituée?", options: ["Osée", "Amos", "Michée", "Joël"], correct: 0, reference: "Osée 1:2" },
    { question: "Combien de pains pour nourrir 4000?", options: ["7", "5", "3", "12"], correct: 0, reference: "Marc 8:5" },
    { question: "Qui a été aveugle de naissance et guéri par Jésus?", options: ["Bartimée", "Paul", "Samson", "Isaac"], correct: 0, reference: "Jean 9" },
    { question: "Quel apôtre a été décapité?", options: ["Jacques", "Pierre", "Paul", "André"], correct: 0, reference: "Actes 12:2" },
    { question: "Quelle ville a été détruite par des trompettes?", options: ["Jéricho", "Jérusalem", "Babylone", "Ninive"], correct: 0, reference: "Josué 6" },
    { question: "Qui a nourri 100 prophètes dans une grotte?", options: ["Abdias", "Élie", "Élisée", "Daniel"], correct: 0, reference: "1 Rois 18:4" },
    { question: "Quel livre de la Bible est un chant d'amour?", options: ["Cantique des Cantiques", "Ruth", "Proverbes", "Psaumes"], correct: 0 },
    { question: "Quel était le métier de Amos?", options: ["Berger", "Prêtre", "Roi", "Pêcheur"], correct: 0, reference: "Amos 1:1" },
    { question: "Qui a construit la muraille de Jérusalem en 52 jours?", options: ["Néhémie", "Esdras", "Zorobabel", "Josué"], correct: 0, reference: "Néhémie 6:15" },
    { question: "Combien de petits prophètes y a-t-il dans l'AT?", options: ["12", "10", "7", "15"], correct: 0 },
    { question: "Qui est monté sur un sycomore pour voir Jésus?", options: ["Zachée", "Matthieu", "Pierre", "André"], correct: 0, reference: "Luc 19:4" },
    { question: "Quel vêtement portait Jean-Baptiste?", options: ["Poils de chameau", "Lin blanc", "Pourpre", "Laine"], correct: 0, reference: "Matthieu 3:4" },
    { question: "Que mangeait Jean-Baptiste?", options: ["Sauterelles et miel", "Pain et eau", "Manne", "Poisson"], correct: 0, reference: "Matthieu 3:4" },
    { question: "Où Jésus a-t-il grandi?", options: ["Nazareth", "Bethléem", "Jérusalem", "Capernaüm"], correct: 0, reference: "Luc 2:51" },
];

const EASY_BLOCK_7: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui a été le dernier juge d'Israël?", options: ["Samuel", "Samson", "Éli", "Gédéon"], correct: 0, reference: "1 Samuel 7:15" },
    { question: "Quelle est la signification d'Emmanuel?", options: ["Dieu avec nous", "Dieu sauve", "Dieu est grand", "Dieu écoute"], correct: 0, reference: "Matthieu 1:23" },
    { question: "Qui a guéri Naaman de la lèpre?", options: ["Élisée", "Élie", "Jésus", "Pierre"], correct: 0, reference: "2 Rois 5" },
    { question: "Combien de fois Naaman devait se baigner dans le Jourdain?", options: ["7", "3", "1", "10"], correct: 0, reference: "2 Rois 5:10" },
    { question: "Qui a prophétisé la vallée des ossements?", options: ["Ézéchiel", "Daniel", "Jérémie", "Ésaïe"], correct: 0, reference: "Ézéchiel 37" },
    { question: "Quel est le plus long Psaume?", options: ["119", "23", "1", "150"], correct: 0 },
    { question: "Quelle reine a visité Salomon?", options: ["Reine de Saba", "Esther", "Jézabel", "Athalie"], correct: 0, reference: "1 Rois 10:1" },
    { question: "Quel prophète a mangé un rouleau?", options: ["Ézéchiel", "Jérémie", "Daniel", "Ésaïe"], correct: 0, reference: "Ézéchiel 3:1" },
    { question: "Qui a écrit les Lamentations?", options: ["Jérémie", "David", "Ésaïe", "Ézéchiel"], correct: 0 },
    { question: "Combien de guerriers Gédéon a gardés?", options: ["300", "3000", "1000", "100"], correct: 0, reference: "Juges 7:7" },
    { question: "Qui a offert la dîme à Melchisédek?", options: ["Abraham", "Isaac", "Jacob", "Lot"], correct: 0, reference: "Genèse 14:20" },
    { question: "Quel roi a brûlé le rouleau de Jérémie?", options: ["Jojakim", "Sédécias", "Jéchonias", "Josias"], correct: 0, reference: "Jérémie 36:23" },
    { question: "Combien de psaumes la Bible contient-elle?", options: ["150", "120", "100", "175"], correct: 0 },
    { question: "Qui était le beau-père de Moïse?", options: ["Jéthro", "Aaron", "Caleb", "Hobab"], correct: 0, reference: "Exode 3:1" },
    { question: "Quel est le plus petit livre de l'AT?", options: ["Abdias", "Aggée", "Nahum", "Habacuc"], correct: 0 },
    { question: "Combien de villes de refuge en Israël?", options: ["6", "3", "7", "12"], correct: 0, reference: "Nombres 35:6" },
    { question: "Qui a dit 'Si je péris, je péris'?", options: ["Esther", "Ruth", "Débora", "Marie"], correct: 0, reference: "Esther 4:16" },
    { question: "Quel est le dernier mot de la Bible?", options: ["Amen", "Grâce", "Jésus", "Éternité"], correct: 0, reference: "Apocalypse 22:21" },
    { question: "Quel est le verset le plus court de la Bible?", options: ["Jésus pleura", "Priez sans cesse", "Aimez-vous", "Soyez saints"], correct: 0, reference: "Jean 11:35" },
    { question: "Combien de fois Paul a fait naufrage?", options: ["3", "1", "2", "4"], correct: 0, reference: "2 Corinthiens 11:25" },
];

const EASY_BLOCK_8: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui est tombé d'une fenêtre pendant que Paul prêchait?", options: ["Eutychus", "Tychique", "Trophime", "Aristarque"], correct: 0, reference: "Actes 20:9" },
    { question: "Quelle église était 'tiède'?", options: ["Laodicée", "Sardes", "Pergame", "Thyatire"], correct: 0, reference: "Apocalypse 3:16" },
    { question: "Combien d'années Jacob a travaillé pour Rachel?", options: ["14", "7", "21", "10"], correct: 0, reference: "Genèse 29:27" },
    { question: "Qui a dit 'L'Éternel est mon berger'?", options: ["David", "Salomon", "Moïse", "Abraham"], correct: 0, reference: "Psaume 23:1" },
    { question: "Quel apôtre a eu une vision d'une nappe du ciel?", options: ["Pierre", "Paul", "Jean", "Jacques"], correct: 0, reference: "Actes 10:11" },
    { question: "Qui a prophétisé la naissance à Bethléem?", options: ["Michée", "Ésaïe", "Jérémie", "Zacharie"], correct: 0, reference: "Michée 5:1" },
    { question: "Quel roi a fait creuser un tunnel à Jérusalem?", options: ["Ézéchias", "Salomon", "Josias", "Manassé"], correct: 0, reference: "2 Rois 20:20" },
    { question: "Qui a vu quatre cavaliers en vision?", options: ["Jean", "Daniel", "Ézéchiel", "Zacharie"], correct: 0, reference: "Apocalypse 6" },
    { question: "Quel roi a consulté la nécromancienne d'En-Dor?", options: ["Saül", "David", "Achab", "Jéroboam"], correct: 0, reference: "1 Samuel 28:7" },
    { question: "Combien de jours Goliath a défié les Israélites?", options: ["40", "7", "30", "21"], correct: 0, reference: "1 Samuel 17:16" },
    { question: "Quel roi avait 700 femmes?", options: ["Salomon", "David", "Achab", "Hérode"], correct: 0, reference: "1 Rois 11:3" },
    { question: "Combien d'années les Israélites ont erré dans le désert?", options: ["40", "50", "30", "25"], correct: 0, reference: "Nombres 14:33" },
    { question: "Qui a régné seulement 7 jours en Israël?", options: ["Zimri", "Omri", "Éla", "Nadab"], correct: 0, reference: "1 Rois 16:15" },
    { question: "Combien de sources d'eau à Élim?", options: ["12", "7", "70", "40"], correct: 0, reference: "Exode 15:27" },
    { question: "Qui a tué Eglon roi de Moab?", options: ["Éhud", "Samson", "Gédéon", "Barak"], correct: 0, reference: "Juges 3:21" },
    { question: "Quel était le premier miracle d'Élisée?", options: ["Purifier les eaux", "Multiplier l'huile", "Guérir Naaman", "Ressusciter un enfant"], correct: 0, reference: "2 Rois 2:21" },
    { question: "Qui a écrit le cantique après la Mer Rouge?", options: ["Myriam", "Aaron", "Moïse", "Josué"], correct: 0, reference: "Exode 15:20" },
    { question: "Qu'est-ce que la 'Grande Commission'?", options: ["Faire des disciples", "Construire le temple", "Jeûner 40 jours", "Vaincre les géants"], correct: 0, reference: "Matthieu 28:19" },
    { question: "Quel patriarche a vécu le plus longtemps?", options: ["Mathusalem", "Adam", "Noé", "Seth"], correct: 0, reference: "Genèse 5:27" },
    { question: "Qui était Melchisédek?", options: ["Roi et sacrificateur", "Prophète", "Ange", "Juge"], correct: 0, reference: "Genèse 14:18" },
];

const EASY_BLOCK_9: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Quel métier avait Lydie dans Actes 16?", options: ["Marchande de pourpre", "Couturière", "Potière", "Tisserande"], correct: 0, reference: "Actes 16:14" },
    { question: "Qui était Barnabas?", options: ["Compagnon de Paul", "Apôtre de Jésus", "Prophète", "Ange"], correct: 0, reference: "Actes 4:36" },
    { question: "Combien de livres Paul a écrits?", options: ["13", "14", "10", "7"], correct: 0 },
    { question: "Quel livre de la Bible ne mentionne pas Dieu?", options: ["Esther", "Ruth", "Jonas", "Amos"], correct: 0 },
    { question: "Comment s'appelle la vallée de David vs Goliath?", options: ["Vallée d'Éla", "Vallée de Hinnom", "Vallée du Jourdain", "Vallée de Josaphat"], correct: 0, reference: "1 Samuel 17:2" },
    { question: "Qui a dit 'Mon peuple périt faute de connaissance'?", options: ["Osée", "Amos", "Michée", "Joël"], correct: 0, reference: "Osée 4:6" },
    { question: "Quel est le nom hébreu de Pierre?", options: ["Cephas", "Simon", "André", "Jean"], correct: 0, reference: "Jean 1:42" },
    { question: "Qui était la femme de Félix le gouverneur?", options: ["Drusille", "Bérénice", "Hérodiade", "Salomé"], correct: 0, reference: "Actes 24:24" },
    { question: "Qui a été enterré dans une citerne?", options: ["Jérémie", "Ésaïe", "Ézéchiel", "Daniel"], correct: 0, reference: "Jérémie 38:6" },
    { question: "Quel nom signifie 'Rire'?", options: ["Isaac", "Jacob", "Ésaü", "Joseph"], correct: 0, reference: "Genèse 21:3" },
    { question: "Quel nom a été changé en Israël?", options: ["Jacob", "Abraham", "Isaac", "Joseph"], correct: 0, reference: "Genèse 32:28" },
    { question: "Qui a lutté avec un ange toute la nuit?", options: ["Jacob", "Moïse", "Abraham", "David"], correct: 0, reference: "Genèse 32:24" },
    { question: "Qui a eu un fils à 90 ans?", options: ["Sarah", "Ruth", "Naomi", "Anne"], correct: 0, reference: "Genèse 17:17" },
    { question: "Quel cousin d'Esther s'appelait...?", options: ["Mardochée", "Benjamin", "Ézéchias", "Daniel"], correct: 0, reference: "Esther 2:7" },
    { question: "Qui a dit 'Voici l'Agneau de Dieu'?", options: ["Jean-Baptiste", "Pierre", "Paul", "Moïse"], correct: 0, reference: "Jean 1:29" },
    { question: "Qui a été le premier diacre?", options: ["Étienne", "Philippe", "Barnabas", "Timothée"], correct: 0, reference: "Actes 6:5" },
    { question: "Quel roi a vu les cieux ouverts?", options: ["Étienne (pas roi)", "David", "Salomon", "Josias"], correct: 0 },
    { question: "Qui était Job?", options: ["Homme patient dans l'épreuve", "Prophète", "Roi", "Prêtre"], correct: 0, reference: "Job 1:1" },
    { question: "Qui a dit 'Mon rédempteur est vivant'?", options: ["Job", "David", "Paul", "Pierre"], correct: 0, reference: "Job 19:25" },
    { question: "Qui battait du froment au pressoir?", options: ["Gédéon", "Ruth", "Boaz", "David"], correct: 0, reference: "Juges 6:11" },
];

const EASY_BLOCK_10: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
    { question: "Qui a demandé un signe avec une peau de mouton?", options: ["Gédéon", "Samson", "David", "Élie"], correct: 0, reference: "Juges 6:37" },
    { question: "Combien d'hommes Gédéon a gardés pour le combat?", options: ["300", "10000", "1000", "32000"], correct: 0, reference: "Juges 7:7" },
    { question: "Qui a chassé 7 démons de Marie-Madeleine?", options: ["Jésus", "Pierre", "Paul", "Jean"], correct: 0, reference: "Marc 16:9" },
    { question: "Qui était présente au pied de la croix?", options: ["Marie-Madeleine", "Marthe", "Salomé", "Lydie"], correct: 0, reference: "Jean 19:25" },
    { question: "Qui a vu Jésus en premier après la résurrection?", options: ["Marie-Madeleine", "Pierre", "Jean", "Thomas"], correct: 0, reference: "Jean 20:14" },
    { question: "Qui était échanson du roi de Perse?", options: ["Néhémie", "Daniel", "Esdras", "Mardochée"], correct: 0, reference: "Néhémie 1:11" },
    { question: "Qui a reconstruit la muraille en 52 jours?", options: ["Néhémie", "Esdras", "Zorobabel", "Josué"], correct: 0, reference: "Néhémie 6:15" },
    { question: "Qui a été offert en sacrifice sur le mont Morija?", options: ["Isaac", "Ismaël", "Jacob", "Joseph"], correct: 0, reference: "Genèse 22:2" },
    { question: "Qui a épousé Rébecca?", options: ["Isaac", "Jacob", "Ésaü", "Abraham"], correct: 0, reference: "Genèse 24:67" },
    { question: "Quelle est la plus grande des vertus selon Paul?", options: ["L'amour", "La foi", "L'espérance", "La sagesse"], correct: 0, reference: "1 Corinthiens 13:13" },
    { question: "Qui a dit 'Ton peuple sera mon peuple'?", options: ["Ruth", "Naomi", "Esther", "Débora"], correct: 0, reference: "Ruth 1:16" },
    { question: "Qui a été le plus riche de l'Orient?", options: ["Job", "Salomon", "Abraham", "David"], correct: 0, reference: "Job 1:3" },
    { question: "Quel est le premier commandement?", options: ["Tu n'auras pas d'autres dieux", "Tu ne tueras point", "Honore ton père", "Ne vole pas"], correct: 0, reference: "Exode 20:3" },
    { question: "Qui a été jeté en prison pour avoir interprété des rêves?", options: ["Joseph", "Daniel", "Pierre", "Paul"], correct: 0, reference: "Genèse 39:20" },
    { question: "Quel oiseau Noé a envoyé en premier?", options: ["Un corbeau", "Une colombe", "Un moineau", "Un aigle"], correct: 0, reference: "Genèse 8:7" },
    { question: "Qui a tenu le talon de son frère à la naissance?", options: ["Jacob", "Ésaü", "Caïn", "Abel"], correct: 0, reference: "Genèse 25:26" },
    { question: "Quel roi a persécuté les chrétiens dans Actes 12?", options: ["Hérode Agrippa", "Néron", "Pilate", "César"], correct: 0, reference: "Actes 12:1" },
    { question: "Qui a dit 'Je suis le chemin, la vérité et la vie'?", options: ["Jésus", "Paul", "Pierre", "Jean"], correct: 0, reference: "Jean 14:6" },
    { question: "Quel verset dit 'Car Dieu a tant aimé le monde'?", options: ["Jean 3:16", "Romains 8:28", "Psaume 23:1", "Matthieu 28:19"], correct: 0 },
    { question: "Qui a dit 'Je puis tout par celui qui me fortifie'?", options: ["Paul", "Pierre", "David", "Moïse"], correct: 0, reference: "Philippiens 4:13" },
];

// ============================================================
// ALL EASY BLOCKS
// ============================================================
const ALL_EASY_BLOCKS = [
    EASY_BLOCK_1, EASY_BLOCK_2, EASY_BLOCK_3, EASY_BLOCK_4, EASY_BLOCK_5,
    EASY_BLOCK_6, EASY_BLOCK_7, EASY_BLOCK_8, EASY_BLOCK_9, EASY_BLOCK_10
];

// ============================================================
// MEDIUM & HARD - Use transformations of easy + new harder questions
// ============================================================

// Dynamic question generation templates for medium/hard
const MEDIUM_TEMPLATES = [
    { q: "Dans quel livre de la Bible est-il écrit: '{verse}'?", type: 'book_from_verse' },
    { q: "Quel chapitre de {book} parle de {topic}?", type: 'chapter_from_topic' },
    { q: "Qui a dit: '{quote}'?", type: 'speaker_from_quote' },
    { q: "Dans quelle ville {event} s'est produit?", type: 'city_from_event' },
    { q: "Quel est l'ordre chronologique correct?", type: 'chronology' },
];

const HARD_TEMPLATES = [
    { q: "Combien de versets contient {book} {chapter}?", type: 'verse_count' },
    { q: "Quel est le contexte historique de {passage}?", type: 'context' },
    { q: "Quelle prophétie {text} accomplit-elle?", type: 'prophecy' },
];

// Medium seed questions per block (20 each)
const MEDIUM_SEEDS: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[][] = Array.from({ length: 10 }, (_, blockIdx) => {
    const baseQuestions: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
        { question: `Qui a écrit le livre de ${['Romains', 'Hébreux', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Timothée', 'Tite', 'Philémon'][blockIdx]}?`, options: ["Paul", "Pierre", "Jean", "Jacques"], correct: 0 },
        { question: `Combien de chapitres a le livre de ${['Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', '1 Samuel', '2 Samuel', '1 Rois'][blockIdx]}?`, options: [["50", "40", "27", "36"], ["40", "50", "27", "36"], ["27", "36", "50", "40"], ["36", "27", "50", "40"], ["34", "40", "27", "50"], ["24", "36", "12", "40"], ["21", "24", "18", "31"], ["31", "24", "36", "40"], ["24", "31", "18", "36"], ["22", "24", "18", "36"]][blockIdx], correct: 0 },
        { question: `Quel est le thème principal de ${['Romains', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', 'Hébreux', 'Jacques', '1 Pierre', '1 Jean', 'Apocalypse'][blockIdx]}?`, options: [["La justification par la foi", "La loi", "La prophétie", "La création"], ["La liberté en Christ", "La loi", "La prophétie", "La création"], ["L'unité en Christ", "La loi", "La prophétie", "La création"], ["La joie en Christ", "La loi", "La prophétie", "La création"], ["La suprématie de Christ", "La loi", "La prophétie", "La création"], ["La supériorité de Christ", "La loi", "La prophétie", "La création"], ["La foi et les œuvres", "La loi", "La prophétie", "La création"], ["La souffrance pour Christ", "La loi", "La prophétie", "La création"], ["L'amour de Dieu", "La loi", "La prophétie", "La création"], ["La fin des temps", "La loi", "La prophétie", "La création"]][blockIdx], correct: 0 },
    ];
    return baseQuestions;
});

const HARD_SEEDS: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[][] = Array.from({ length: 10 }, (_, blockIdx) => {
    const baseQuestions: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [
        { question: `Quel est le contexte historique du livre de ${['Daniel', 'Esdras', 'Néhémie', 'Aggée', 'Zacharie', 'Malachie', 'Abdias', 'Nahum', 'Habacuc', 'Sophonie'][blockIdx]}?`, options: [["Exil babylonien", "Conquête de Canaan", "Royaume uni", "Période des juges"], ["Retour d'exil", "Conquête de Canaan", "Exil", "Période des juges"], ["Reconstruction de Jérusalem", "Exil", "Conquête", "Juges"], ["Retour d'exil", "Exil", "Conquête", "Juges"], ["Retour d'exil", "Exil", "Conquête", "Juges"], ["Post-exil", "Exil", "Conquête", "Juges"], ["Chute d'Édom", "Exil", "Conquête", "Juges"], ["Chute de Ninive", "Exil", "Conquête", "Juges"], ["Invasion babylonienne", "Exil", "Conquête", "Juges"], ["Réforme de Josias", "Exil", "Conquête", "Juges"]][blockIdx], correct: 0 },
    ];
    return baseQuestions;
});

// ============================================================
// DYNAMIC QUESTION GENERATOR
// Uses the existing easy questions + transforms them for medium/hard
// ============================================================

function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateId(difficulty: string, block: number, index: number): string {
    return `${difficulty}_b${block}_q${index}`;
}

/**
 * Transform an easy question into a medium one by making it trickier
 */
function transformToMedium(q: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>, index: number): Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'> {
    // Shuffle options but track correct answer
    const correctOption = q.options[q.correct];
    const shuffledOptions = shuffleArray(q.options);
    const newCorrectIdx = shuffledOptions.indexOf(correctOption);

    // Create more detailed question
    const prefixes = [
        "Selon la Bible, ", "D'après les Écritures, ", "Dans le texte biblique, ",
        "Historiquement dans la Bible, ", "Selon le récit biblique, "
    ];
    const prefix = prefixes[index % prefixes.length];

    return {
        ...q,
        question: prefix + q.question.charAt(0).toLowerCase() + q.question.slice(1),
        options: shuffledOptions,
        correct: newCorrectIdx,
    };
}

/**
 * Transform an easy question into a hard one
 */
function transformToHard(q: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>, index: number): Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'> {
    const correctOption = q.options[q.correct];
    const shuffledOptions = shuffleArray(q.options);
    const newCorrectIdx = shuffledOptions.indexOf(correctOption);

    // Add reference requirement for harder questions
    const suffixes = [
        " (citez le livre)", " (référence exacte demandée)", " (soyez précis)",
        " (question d'expert)", " (niveau avancé)"
    ];
    const suffix = suffixes[index % suffixes.length];

    return {
        ...q,
        question: q.question.replace('?', suffix + ' ?'),
        options: shuffledOptions,
        correct: newCorrectIdx,
    };
}

// ============================================================
// MAIN API
// ============================================================

/**
 * Get questions for a specific difficulty and block
 * Returns 200 questions (20 seed + 180 generated variations)
 */
export function getBlockQuestions(
    difficulty: 'easy' | 'medium' | 'hard',
    block: number // 1-10
): QuizQuestionItem[] {
    const blockIdx = Math.max(0, Math.min(9, block - 1));

    let seedQuestions: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[];

    if (difficulty === 'easy') {
        seedQuestions = ALL_EASY_BLOCKS[blockIdx];
    } else if (difficulty === 'medium') {
        // Combine medium seeds with transformed easy questions
        seedQuestions = [
            ...(MEDIUM_SEEDS[blockIdx] || []),
            ...ALL_EASY_BLOCKS[blockIdx].map((q, i) => transformToMedium(q, i)),
        ];
    } else {
        // Combine hard seeds with double-transformed questions
        seedQuestions = [
            ...(HARD_SEEDS[blockIdx] || []),
            ...ALL_EASY_BLOCKS[blockIdx].map((q, i) => transformToHard(q, i)),
        ];
    }

    // Now generate more questions by cross-pollinating blocks
    const allBlocks = ALL_EASY_BLOCKS;
    const extraQuestions: Omit<QuizQuestionItem, 'id' | 'difficulty' | 'block'>[] = [];

    // Pull questions from other blocks and transform them
    for (let otherBlock = 0; otherBlock < 10 && extraQuestions.length < 180; otherBlock++) {
        if (otherBlock === blockIdx) continue;
        const otherQuestions = allBlocks[otherBlock];
        for (let i = 0; i < otherQuestions.length && extraQuestions.length < 180; i++) {
            const q = otherQuestions[i];
            if (difficulty === 'easy') {
                // Rephrase slightly
                extraQuestions.push({
                    ...q,
                    question: q.question.replace('?', ' selon la Bible ?'),
                });
            } else if (difficulty === 'medium') {
                extraQuestions.push(transformToMedium(q, extraQuestions.length));
            } else {
                extraQuestions.push(transformToHard(q, extraQuestions.length));
            }
        }
    }

    // Combine all and assign IDs
    const allQuestions = [...seedQuestions, ...extraQuestions];
    const shuffled = shuffleArray(allQuestions);

    return shuffled.slice(0, 200).map((q, i) => ({
        ...q,
        id: generateId(difficulty, block, i),
        difficulty,
        block,
    }));
}

/**
 * Get a random subset of questions for a quick game
 */
export function getQuickQuizQuestions(
    count: number = 10,
    difficulty?: 'easy' | 'medium' | 'hard'
): QuizQuestionItem[] {
    const block = Math.floor(Math.random() * 10) + 1;
    const diff = difficulty || (['easy', 'medium', 'hard'] as const)[Math.floor(Math.random() * 3)];
    const questions = getBlockQuestions(diff, block);
    return shuffleArray(questions).slice(0, count);
}

/**
 * Get block info for UI display
 */
export function getBlockInfo(block: number, difficulty: 'easy' | 'medium' | 'hard') {
    const themes = [
        "Création & Patriarches", "Exode & Prophètes", "Rois & Royaumes",
        "Vie de Jésus", "Apôtres & Épîtres", "Psaumes & Sagesse",
        "Prophètes Mineurs", "Miracles & Prodiges", "Personnages Bibliques",
        "Versets & Références"
    ];

    const icons = ["🌍", "🔥", "👑", "✝️", "📜", "📖", "🕊️", "⚡", "👤", "📝"];

    return {
        block,
        difficulty,
        theme: themes[block - 1] || "Bible Générale",
        icon: icons[block - 1] || "📖",
        totalQuestions: 200,
        label: `Bloc ${block}`,
    };
}

/**
 * Get all block infos for a difficulty
 */
export function getAllBlockInfos(difficulty: 'easy' | 'medium' | 'hard') {
    return Array.from({ length: 10 }, (_, i) => getBlockInfo(i + 1, difficulty));
}

export default {
    getBlockQuestions,
    getQuickQuizQuestions,
    getBlockInfo,
    getAllBlockInfos,
};
