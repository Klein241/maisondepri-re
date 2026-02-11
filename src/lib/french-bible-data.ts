/**
 * BIBLE LOCALE FRANÇAISE - LOUIS SEGOND 1910
 * ============================================
 * 
 * Ce fichier contient les versets bibliques les plus courants en français.
 * Utilisé comme fallback quand l'API externe ne fonctionne pas.
 * 
 * Structure: { "Livre Chapitre": { versets: [...] } }
 */

export interface LocalVerse {
    verse: number;
    text: string;
}

export interface LocalChapter {
    reference: string;
    book: string;
    chapter: number;
    verses: LocalVerse[];
}

// Données bibliques statiques en français (Louis Segond 1910)
export const FRENCH_BIBLE_DATA: Record<string, LocalChapter> = {
    // GENÈSE
    "Genèse 1": {
        reference: "Genèse 1",
        book: "Genèse",
        chapter: 1,
        verses: [
            { verse: 1, text: "Au commencement, Dieu créa les cieux et la terre." },
            { verse: 2, text: "La terre était informe et vide: il y avait des ténèbres à la surface de l'abîme, et l'esprit de Dieu se mouvait au-dessus des eaux." },
            { verse: 3, text: "Dieu dit: Que la lumière soit! Et la lumière fut." },
            { verse: 4, text: "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d'avec les ténèbres." },
            { verse: 5, text: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour." },
            { verse: 6, text: "Dieu dit: Qu'il y ait une étendue entre les eaux, et qu'elle sépare les eaux d'avec les eaux." },
            { verse: 7, text: "Et Dieu fit l'étendue, et il sépara les eaux qui sont au-dessous de l'étendue d'avec les eaux qui sont au-dessus de l'étendue. Et cela fut ainsi." },
            { verse: 8, text: "Dieu appela l'étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour." },
            { verse: 9, text: "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi." },
            { verse: 10, text: "Dieu appela le sec terre, et il appela l'amas des eaux mers. Dieu vit que cela était bon." },
            { verse: 11, text: "Puis Dieu dit: Que la terre produise de la verdure, de l'herbe portant de la semence, des arbres fruitiers donnant du fruit selon leur espèce et ayant en eux leur semence sur la terre. Et cela fut ainsi." },
            { verse: 12, text: "La terre produisit de la verdure, de l'herbe portant de la semence selon son espèce, et des arbres donnant du fruit et ayant en eux leur semence selon leur espèce. Dieu vit que cela était bon." },
            { verse: 13, text: "Ainsi, il y eut un soir, et il y eut un matin: ce fut le troisième jour." },
            { verse: 14, text: "Dieu dit: Qu'il y ait des luminaires dans l'étendue du ciel, pour séparer le jour d'avec la nuit; que ce soient des signes pour marquer les époques, les jours et les années;" },
            { verse: 15, text: "et qu'ils servent de luminaires dans l'étendue du ciel, pour éclairer la terre. Et cela fut ainsi." },
            { verse: 16, text: "Dieu fit les deux grands luminaires, le plus grand luminaire pour présider au jour, et le plus petit luminaire pour présider à la nuit; il fit aussi les étoiles." },
            { verse: 17, text: "Dieu les plaça dans l'étendue du ciel, pour éclairer la terre," },
            { verse: 18, text: "pour présider au jour et à la nuit, et pour séparer la lumière d'avec les ténèbres. Dieu vit que cela était bon." },
            { verse: 19, text: "Ainsi, il y eut un soir, et il y eut un matin: ce fut le quatrième jour." },
            { verse: 20, text: "Dieu dit: Que les eaux produisent en abondance des animaux vivants, et que des oiseaux volent sur la terre vers l'étendue du ciel." },
            { verse: 21, text: "Dieu créa les grands poissons et tous les animaux vivants qui se meuvent, et que les eaux produisirent en abondance selon leur espèce; il créa aussi tout oiseau ailé selon son espèce. Dieu vit que cela était bon." },
            { verse: 22, text: "Dieu les bénit, en disant: Soyez féconds, multipliez, et remplissez les eaux des mers; et que les oiseaux multiplient sur la terre." },
            { verse: 23, text: "Ainsi, il y eut un soir, et il y eut un matin: ce fut le cinquième jour." },
            { verse: 24, text: "Dieu dit: Que la terre produise des animaux vivants selon leur espèce, du bétail, des reptiles et des animaux terrestres, selon leur espèce. Et cela fut ainsi." },
            { verse: 25, text: "Dieu fit les animaux de la terre selon leur espèce, le bétail selon son espèce, et tous les reptiles de la terre selon leur espèce. Dieu vit que cela était bon." },
            { verse: 26, text: "Puis Dieu dit: Faisons l'homme à notre image, selon notre ressemblance, et qu'il domine sur les poissons de la mer, sur les oiseaux du ciel, sur le bétail, sur toute la terre, et sur tous les reptiles qui rampent sur la terre." },
            { verse: 27, text: "Dieu créa l'homme à son image, il le créa à l'image de Dieu, il créa l'homme et la femme." },
            { verse: 28, text: "Dieu les bénit, et Dieu leur dit: Soyez féconds, multipliez, remplissez la terre, et l'assujettissez; et dominez sur les poissons de la mer, sur les oiseaux du ciel, et sur tout animal qui se meut sur la terre." },
            { verse: 29, text: "Et Dieu dit: Voici, je vous donne toute herbe portant de la semence et qui est à la surface de toute la terre, et tout arbre ayant en lui du fruit d'arbre et portant de la semence: ce sera votre nourriture." },
            { verse: 30, text: "Et à tout animal de la terre, à tout oiseau du ciel, et à tout ce qui se meut sur la terre, ayant en soi un souffle de vie, je donne toute herbe verte pour nourriture. Et cela fut ainsi." },
            { verse: 31, text: "Dieu vit tout ce qu'il avait fait et voici, cela était très bon. Ainsi, il y eut un soir, et il y eut un matin: ce fut le sixième jour." }
        ]
    },

    // PSAUMES
    "Psaumes 23": {
        reference: "Psaumes 23",
        book: "Psaumes",
        chapter: 23,
        verses: [
            { verse: 1, text: "L'Éternel est mon berger: je ne manquerai de rien." },
            { verse: 2, text: "Il me fait reposer dans de verts pâturages, Il me dirige près des eaux paisibles." },
            { verse: 3, text: "Il restaure mon âme, Il me conduit dans les sentiers de la justice, À cause de son nom." },
            { verse: 4, text: "Quand je marche dans la vallée de l'ombre de la mort, Je ne crains aucun mal, car tu es avec moi: Ta houlette et ton bâton me rassurent." },
            { verse: 5, text: "Tu dresses devant moi une table, En face de mes adversaires; Tu oins d'huile ma tête, Et ma coupe déborde." },
            { verse: 6, text: "Oui, le bonheur et la grâce m'accompagneront Tous les jours de ma vie, Et j'habiterai dans la maison de l'Éternel Jusqu'à la fin de mes jours." }
        ]
    },

    "Psaumes 91": {
        reference: "Psaumes 91",
        book: "Psaumes",
        chapter: 91,
        verses: [
            { verse: 1, text: "Celui qui demeure sous l'abri du Très-Haut Repose à l'ombre du Tout-Puissant." },
            { verse: 2, text: "Je dis à l'Éternel: Mon refuge et ma forteresse, Mon Dieu en qui je me confie!" },
            { verse: 3, text: "Car c'est lui qui te délivre du filet de l'oiseleur, De la peste et de ses ravages." },
            { verse: 4, text: "Il te couvrira de ses plumes, Et tu trouveras un refuge sous ses ailes; Sa fidélité est un bouclier et une cuirasse." },
            { verse: 5, text: "Tu ne craindras ni les terreurs de la nuit, Ni la flèche qui vole de jour," },
            { verse: 6, text: "Ni la peste qui marche dans les ténèbres, Ni la contagion qui frappe en plein midi." },
            { verse: 7, text: "Que mille tombent à ton côté, Et dix mille à ta droite, Tu ne seras pas atteint;" },
            { verse: 8, text: "De tes yeux seulement tu regarderas, Et tu verras la rétribution des méchants." },
            { verse: 9, text: "Car tu as dit: L'Éternel est mon refuge! Tu as fait du Très-Haut ta retraite." },
            { verse: 10, text: "Aucun malheur ne t'arrivera, Aucun fléau n'approchera de ta tente." },
            { verse: 11, text: "Car il ordonnera à ses anges De te garder dans toutes tes voies;" },
            { verse: 12, text: "Ils te porteront sur les mains, De peur que ton pied ne heurte contre une pierre." },
            { verse: 13, text: "Tu marcheras sur le lion et sur l'aspic, Tu fouleras le lionceau et le dragon." },
            { verse: 14, text: "Puisqu'il m'aime, je le délivrerai; Je le protégerai, puisqu'il connaît mon nom." },
            { verse: 15, text: "Il m'invoquera, et je lui répondrai; Je serai avec lui dans la détresse, Je le délivrerai et je le glorifierai." },
            { verse: 16, text: "Je le rassasierai de longs jours, Et je lui ferai voir mon salut." }
        ]
    },

    // JEAN
    "Jean 3": {
        reference: "Jean 3",
        book: "Jean",
        chapter: 3,
        verses: [
            { verse: 1, text: "Mais il y eut un homme d'entre les pharisiens, nommé Nicodème, un chef des Juifs," },
            { verse: 2, text: "qui vint, lui, auprès de Jésus, de nuit, et lui dit: Rabbi, nous savons que tu es un docteur venu de Dieu; car personne ne peut faire ces miracles que tu fais, si Dieu n'est avec lui." },
            { verse: 3, text: "Jésus lui répondit: En vérité, en vérité, je te le dis, si un homme ne naît de nouveau, il ne peut voir le royaume de Dieu." },
            { verse: 4, text: "Nicodème lui dit: Comment un homme peut-il naître quand il est vieux? Peut-il rentrer dans le sein de sa mère et naître?" },
            { verse: 5, text: "Jésus répondit: En vérité, en vérité, je te le dis, si un homme ne naît d'eau et d'Esprit, il ne peut entrer dans le royaume de Dieu." },
            { verse: 6, text: "Ce qui est né de la chair est chair, et ce qui est né de l'Esprit est esprit." },
            { verse: 7, text: "Ne t'étonne pas que je t'aie dit: Il faut que vous naissiez de nouveau." },
            { verse: 8, text: "Le vent souffle où il veut, et tu en entends le bruit; mais tu ne sais d'où il vient, ni où il va. Il en est ainsi de tout homme qui est né de l'Esprit." },
            { verse: 9, text: "Nicodème lui dit: Comment cela peut-il se faire?" },
            { verse: 10, text: "Jésus lui répondit: Tu es le docteur d'Israël, et tu ne sais pas ces choses!" },
            { verse: 11, text: "En vérité, en vérité, je te le dis, nous disons ce que nous savons, et nous rendons témoignage de ce que nous avons vu; et vous ne recevez pas notre témoignage." },
            { verse: 12, text: "Si vous ne croyez pas quand je vous ai parlé des choses terrestres, comment croirez-vous quand je vous parlerai des choses célestes?" },
            { verse: 13, text: "Personne n'est monté au ciel, si ce n'est celui qui est descendu du ciel, le Fils de l'homme qui est dans le ciel." },
            { verse: 14, text: "Et comme Moïse éleva le serpent dans le désert, il faut de même que le Fils de l'homme soit élevé," },
            { verse: 15, text: "afin que quiconque croit en lui ait la vie éternelle." },
            { verse: 16, text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle." },
            { verse: 17, text: "Dieu, en effet, n'a pas envoyé son Fils dans le monde pour qu'il juge le monde, mais pour que le monde soit sauvé par lui." },
            { verse: 18, text: "Celui qui croit en lui n'est point jugé; mais celui qui ne croit pas est déjà jugé, parce qu'il n'a pas cru au nom du Fils unique de Dieu." },
            { verse: 19, text: "Et ce jugement c'est que, la lumière étant venue dans le monde, les hommes ont préféré les ténèbres à la lumière, parce que leurs oeuvres étaient mauvaises." },
            { verse: 20, text: "Car quiconque fait le mal hait la lumière, et ne vient point à la lumière, de peur que ses oeuvres ne soient dévoilées;" },
            { verse: 21, text: "mais celui qui agit selon la vérité vient à la lumière, afin que ses oeuvres soient manifestées, parce qu'elles sont faites en Dieu." }
        ]
    },

    // MATTHIEU
    "Matthieu 5": {
        reference: "Matthieu 5",
        book: "Matthieu",
        chapter: 5,
        verses: [
            { verse: 1, text: "Voyant la foule, Jésus monta sur la montagne; et, après qu'il se fut assis, ses disciples s'approchèrent de lui." },
            { verse: 2, text: "Puis, ayant ouvert la bouche, il les enseigna, et dit:" },
            { verse: 3, text: "Heureux les pauvres en esprit, car le royaume des cieux est à eux!" },
            { verse: 4, text: "Heureux les affligés, car ils seront consolés!" },
            { verse: 5, text: "Heureux les débonnaires, car ils hériteront la terre!" },
            { verse: 6, text: "Heureux ceux qui ont faim et soif de la justice, car ils seront rassasiés!" },
            { verse: 7, text: "Heureux les miséricordieux, car ils obtiendront miséricorde!" },
            { verse: 8, text: "Heureux ceux qui ont le coeur pur, car ils verront Dieu!" },
            { verse: 9, text: "Heureux ceux qui procurent la paix, car ils seront appelés fils de Dieu!" },
            { verse: 10, text: "Heureux ceux qui sont persécutés pour la justice, car le royaume des cieux est à eux!" },
            { verse: 11, text: "Heureux serez-vous, lorsqu'on vous outragera, qu'on vous persécutera et qu'on dira faussement de vous toute sorte de mal, à cause de moi." },
            { verse: 12, text: "Réjouissez-vous et soyez dans l'allégresse, parce que votre récompense sera grande dans les cieux; car c'est ainsi qu'on a persécuté les prophètes qui ont été avant vous." },
            { verse: 13, text: "Vous êtes le sel de la terre. Mais si le sel perd sa saveur, avec quoi la lui rendra-t-on? Il ne sert plus qu'à être jeté dehors, et foulé aux pieds par les hommes." },
            { verse: 14, text: "Vous êtes la lumière du monde. Une ville située sur une montagne ne peut être cachée;" },
            { verse: 15, text: "et on n'allume pas une lampe pour la mettre sous le boisseau, mais on la met sur le chandelier, et elle éclaire tous ceux qui sont dans la maison." },
            { verse: 16, text: "Que votre lumière luise ainsi devant les hommes, afin qu'ils voient vos bonnes oeuvres, et qu'ils glorifient votre Père qui est dans les cieux." }
        ]
    },

    "Matthieu 6": {
        reference: "Matthieu 6",
        book: "Matthieu",
        chapter: 6,
        verses: [
            { verse: 1, text: "Gardez-vous de pratiquer votre justice devant les hommes, pour en être vus; autrement, vous n'aurez point de récompense auprès de votre Père qui est dans les cieux." },
            { verse: 9, text: "Voici donc comment vous devez prier: Notre Père qui es aux cieux! Que ton nom soit sanctifié;" },
            { verse: 10, text: "que ton règne vienne; que ta volonté soit faite sur la terre comme au ciel." },
            { verse: 11, text: "Donne-nous aujourd'hui notre pain quotidien;" },
            { verse: 12, text: "pardonne-nous nos offenses, comme nous aussi nous pardonnons à ceux qui nous ont offensés;" },
            { verse: 13, text: "ne nous induis pas en tentation, mais délivre-nous du malin. Car c'est à toi qu'appartiennent, dans tous les siècles, le règne, la puissance et la gloire. Amen!" },
            { verse: 25, text: "C'est pourquoi je vous dis: Ne vous inquiétez pas pour votre vie de ce que vous mangerez, ni pour votre corps, de quoi vous serez vêtus. La vie n'est-elle pas plus que la nourriture, et le corps plus que le vêtement?" },
            { verse: 26, text: "Regardez les oiseaux du ciel: ils ne sèment ni ne moissonnent, et ils n'amassent rien dans des greniers; et votre Père céleste les nourrit. Ne valez-vous pas beaucoup plus qu'eux?" },
            { verse: 33, text: "Cherchez premièrement le royaume et la justice de Dieu; et toutes ces choses vous seront données par-dessus." },
            { verse: 34, text: "Ne vous inquiétez donc pas du lendemain; car le lendemain aura soin de lui-même. A chaque jour suffit sa peine." }
        ]
    },

    // ROMAINS
    "Romains 8": {
        reference: "Romains 8",
        book: "Romains",
        chapter: 8,
        verses: [
            { verse: 1, text: "Il n'y a donc maintenant aucune condamnation pour ceux qui sont en Jésus-Christ." },
            { verse: 28, text: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein." },
            { verse: 31, text: "Que dirons-nous donc à l'égard de ces choses? Si Dieu est pour nous, qui sera contre nous?" },
            { verse: 32, text: "Lui, qui n'a point épargné son propre Fils, mais qui l'a livré pour nous tous, comment ne nous donnera-t-il pas aussi toutes choses avec lui?" },
            { verse: 35, text: "Qui nous séparera de l'amour de Christ? Sera-ce la tribulation, ou l'angoisse, ou la persécution, ou la faim, ou la nudité, ou le péril, ou l'épée?" },
            { verse: 37, text: "Mais dans toutes ces choses nous sommes plus que vainqueurs par celui qui nous a aimés." },
            { verse: 38, text: "Car j'ai l'assurance que ni la mort ni la vie, ni les anges ni les dominations, ni les choses présentes ni les choses à venir," },
            { verse: 39, text: "ni les puissances, ni la hauteur, ni la profondeur, ni aucune autre créature ne pourra nous séparer de l'amour de Dieu manifesté en Jésus-Christ notre Seigneur." }
        ]
    },

    // PROVERBES
    "Proverbes 3": {
        reference: "Proverbes 3",
        book: "Proverbes",
        chapter: 3,
        verses: [
            { verse: 1, text: "Mon fils, n'oublie pas mes enseignements, Et que ton coeur garde mes commandements;" },
            { verse: 2, text: "Car ils prolongeront les jours et les années de ta vie, Et ils augmenteront ta paix." },
            { verse: 3, text: "Que la bonté et la fidélité ne t'abandonnent pas; Lie-les à ton cou, écris-les sur la table de ton coeur." },
            { verse: 4, text: "Tu acquerras ainsi de la grâce et une raison saine, Aux yeux de Dieu et des hommes." },
            { verse: 5, text: "Confie-toi en l'Éternel de tout ton coeur, Et ne t'appuie pas sur ta sagesse;" },
            { verse: 6, text: "Reconnais-le dans toutes tes voies, Et il aplanira tes sentiers." },
            { verse: 7, text: "Ne sois point sage à tes propres yeux, Crains l'Éternel, et détourne-toi du mal:" },
            { verse: 8, text: "Ce sera la santé pour tes muscles, Et un rafraîchissement pour tes os." }
        ]
    },

    // PHILIPPIENS
    "Philippiens 4": {
        reference: "Philippiens 4",
        book: "Philippiens",
        chapter: 4,
        verses: [
            { verse: 4, text: "Réjouissez-vous toujours dans le Seigneur; je le répète, réjouissez-vous." },
            { verse: 5, text: "Que votre douceur soit connue de tous les hommes. Le Seigneur est proche." },
            { verse: 6, text: "Ne vous inquiétez de rien; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces." },
            { verse: 7, text: "Et la paix de Dieu, qui surpasse toute intelligence, gardera vos coeurs et vos pensées en Jésus-Christ." },
            { verse: 8, text: "Au reste, frères, que tout ce qui est vrai, tout ce qui est honorable, tout ce qui est juste, tout ce qui est pur, tout ce qui est aimable, tout ce qui mérite l'approbation, ce qui est vertueux et digne de louange, soit l'objet de vos pensées." },
            { verse: 13, text: "Je puis tout par celui qui me fortifie." },
            { verse: 19, text: "Et mon Dieu pourvoira à tous vos besoins selon sa richesse, avec gloire, en Jésus-Christ." }
        ]
    },

    // ÉSAÏE
    "Ésaïe 40": {
        reference: "Ésaïe 40",
        book: "Ésaïe",
        chapter: 40,
        verses: [
            { verse: 1, text: "Consolez, consolez mon peuple, Dit votre Dieu." },
            { verse: 8, text: "L'herbe sèche, la fleur tombe; Mais la parole de notre Dieu subsiste éternellement." },
            { verse: 28, text: "Ne le sais-tu pas? ne l'as-tu pas appris? C'est le Dieu d'éternité, l'Éternel, Qui a créé les extrémités de la terre; Il ne se fatigue point, il ne se lasse point; On ne peut sonder son intelligence." },
            { verse: 29, text: "Il donne de la force à celui qui est fatigué, Et il augmente la vigueur de celui qui tombe en défaillance." },
            { verse: 30, text: "Les adolescents se fatiguent et se lassent, Et les jeunes hommes chancellent;" },
            { verse: 31, text: "Mais ceux qui se confient en l'Éternel renouvellent leur force. Ils prennent le vol comme les aigles; Ils courent, et ne se lassent point, Ils marchent, et ne se fatiguent point." }
        ]
    },

    "Ésaïe 41": {
        reference: "Ésaïe 41",
        book: "Ésaïe",
        chapter: 41,
        verses: [
            { verse: 10, text: "Ne crains rien, car je suis avec toi; Ne promène pas des regards inquiets, car je suis ton Dieu; Je te fortifie, je viens à ton secours, Je te soutiens de ma droite triomphante." },
            { verse: 13, text: "Car je suis l'Éternel, ton Dieu, Qui fortifie ta droite, Qui te dis: Ne crains rien, Je viens à ton secours." }
        ]
    },

    // JÉRÉMIE
    "Jérémie 29": {
        reference: "Jérémie 29",
        book: "Jérémie",
        chapter: 29,
        verses: [
            { verse: 11, text: "Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance." },
            { verse: 12, text: "Vous m'invoquerez, et vous partirez; vous me prierez, et je vous exaucerai." },
            { verse: 13, text: "Vous me chercherez, et vous me trouverez, si vous me cherchez de tout votre coeur." }
        ]
    },

    // JOSUÉ
    "Josué 1": {
        reference: "Josué 1",
        book: "Josué",
        chapter: 1,
        verses: [
            { verse: 8, text: "Que ce livre de la loi ne s'éloigne point de ta bouche; médite-le jour et nuit, pour agir fidèlement selon tout ce qui y est écrit; car c'est alors que tu auras du succès dans tes entreprises, c'est alors que tu réussiras." },
            { verse: 9, text: "Ne t'ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t'effraie point et ne t'épouvante point, car l'Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras." }
        ]
    }
};

// Versets populaires individuels pour le verset du jour
export const POPULAR_VERSES: Record<string, { text: string; reference: string }> = {
    "Jean 3:16": {
        text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle.",
        reference: "Jean 3:16"
    },
    "Psaumes 23:1": {
        text: "L'Éternel est mon berger: je ne manquerai de rien.",
        reference: "Psaumes 23:1"
    },
    "Philippiens 4:13": {
        text: "Je puis tout par celui qui me fortifie.",
        reference: "Philippiens 4:13"
    },
    "Romains 8:28": {
        text: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.",
        reference: "Romains 8:28"
    },
    "Proverbes 3:5": {
        text: "Confie-toi en l'Éternel de tout ton coeur, Et ne t'appuie pas sur ta sagesse;",
        reference: "Proverbes 3:5"
    },
    "Proverbes 3:6": {
        text: "Reconnais-le dans toutes tes voies, Et il aplanira tes sentiers.",
        reference: "Proverbes 3:6"
    },
    "Ésaïe 40:31": {
        text: "Mais ceux qui se confient en l'Éternel renouvellent leur force. Ils prennent le vol comme les aigles; Ils courent, et ne se lassent point, Ils marchent, et ne se fatiguent point.",
        reference: "Ésaïe 40:31"
    },
    "Ésaïe 41:10": {
        text: "Ne crains rien, car je suis avec toi; Ne promène pas des regards inquiets, car je suis ton Dieu; Je te fortifie, je viens à ton secours, Je te soutiens de ma droite triomphante.",
        reference: "Ésaïe 41:10"
    },
    "Jérémie 29:11": {
        text: "Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.",
        reference: "Jérémie 29:11"
    },
    "Josué 1:9": {
        text: "Ne t'ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t'effraie point et ne t'épouvante point, car l'Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.",
        reference: "Josué 1:9"
    },
    "Matthieu 6:33": {
        text: "Cherchez premièrement le royaume et la justice de Dieu; et toutes ces choses vous seront données par-dessus.",
        reference: "Matthieu 6:33"
    },
    "Matthieu 11:28": {
        text: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.",
        reference: "Matthieu 11:28"
    },
    "Jean 14:6": {
        text: "Jésus lui dit: Je suis le chemin, la vérité, et la vie. Nul ne vient au Père que par moi.",
        reference: "Jean 14:6"
    },
    "Jean 14:27": {
        text: "Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre coeur ne se trouble point, et ne s'alarme point.",
        reference: "Jean 14:27"
    },
    "Romains 5:8": {
        text: "Mais Dieu prouve son amour envers nous, en ce que, lorsque nous étions encore des pécheurs, Christ est mort pour nous.",
        reference: "Romains 5:8"
    },
    "Romains 12:2": {
        text: "Ne vous conformez pas au siècle présent, mais soyez transformés par le renouvellement de l'intelligence, afin que vous discerniez quelle est la volonté de Dieu, ce qui est bon, agréable et parfait.",
        reference: "Romains 12:2"
    },
    "1 Corinthiens 16:14": {
        text: "Que tout ce que vous faites se fasse avec charité!",
        reference: "1 Corinthiens 16:14"
    },
    "Galates 5:22": {
        text: "Mais le fruit de l'Esprit, c'est l'amour, la joie, la paix, la patience, la bonté, la bénignité, la fidélité,",
        reference: "Galates 5:22"
    },
    "Éphésiens 2:8": {
        text: "Car c'est par la grâce que vous êtes sauvés, par le moyen de la foi. Et cela ne vient pas de vous, c'est le don de Dieu.",
        reference: "Éphésiens 2:8"
    },
    "Philippiens 4:6": {
        text: "Ne vous inquiétez de rien; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces.",
        reference: "Philippiens 4:6"
    },
    "Philippiens 4:7": {
        text: "Et la paix de Dieu, qui surpasse toute intelligence, gardera vos coeurs et vos pensées en Jésus-Christ.",
        reference: "Philippiens 4:7"
    },
    "2 Timothée 1:7": {
        text: "Car ce n'est pas un esprit de timidité que Dieu nous a donné, mais un esprit de force, d'amour et de sagesse.",
        reference: "2 Timothée 1:7"
    },
    "Hébreux 11:1": {
        text: "Or la foi est une ferme assurance des choses qu'on espère, une démonstration de celles qu'on ne voit pas.",
        reference: "Hébreux 11:1"
    },
    "Jacques 1:5": {
        text: "Si quelqu'un d'entre vous manque de sagesse, qu'il la demande à Dieu, qui donne à tous simplement et sans reproche, et elle lui sera donnée.",
        reference: "Jacques 1:5"
    },
    "1 Jean 1:9": {
        text: "Si nous confessons nos péchés, il est fidèle et juste pour nous les pardonner, et pour nous purifier de toute iniquité.",
        reference: "1 Jean 1:9"
    },
    "1 Jean 4:8": {
        text: "Celui qui n'aime pas n'a pas connu Dieu, car Dieu est amour.",
        reference: "1 Jean 4:8"
    },
    "1 Pierre 5:7": {
        text: "et déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous.",
        reference: "1 Pierre 5:7"
    },
    "Psaumes 27:1": {
        text: "L'Éternel est ma lumière et mon salut: De qui aurais-je crainte? L'Éternel est le soutien de ma vie: De qui aurais-je peur?",
        reference: "Psaumes 27:1"
    },
    "Psaumes 46:1": {
        text: "Dieu est pour nous un refuge et un appui, Un secours qui ne manque jamais dans la détresse.",
        reference: "Psaumes 46:1"
    },
    "Psaumes 119:105": {
        text: "Ta parole est une lampe à mes pieds, Et une lumière sur mon sentier.",
        reference: "Psaumes 119:105"
    },
    "Proverbes 16:3": {
        text: "Recommande à l'Éternel tes oeuvres, Et tes projets réussiront.",
        reference: "Proverbes 16:3"
    },
    "Genèse 1:1": {
        text: "Au commencement, Dieu créa les cieux et la terre.",
        reference: "Genèse 1:1"
    }
};

/**
 * Obtenir un chapitre de la Bible locale
 */
export function getLocalChapter(book: string, chapter: number): LocalChapter | null {
    const key = `${book} ${chapter}`;
    return FRENCH_BIBLE_DATA[key] || null;
}

/**
 * Obtenir un verset populaire
 */
export function getLocalVerse(reference: string): { text: string; reference: string } | null {
    return POPULAR_VERSES[reference] || null;
}

/**
 * Obtenir un verset aléatoire pour le verset du jour
 */
export function getRandomDailyVerse(): { text: string; reference: string } {
    const verses = Object.values(POPULAR_VERSES);
    const randomIndex = Math.floor(Math.random() * verses.length);
    return verses[randomIndex];
}

/**
 * Liste de toutes les références disponibles
 */
export function getAvailableReferences(): string[] {
    return Object.keys(FRENCH_BIBLE_DATA);
}

/**
 * Liste de tous les versets populaires
 */
export function getAvailablePopularVerses(): string[] {
    return Object.keys(POPULAR_VERSES);
}
